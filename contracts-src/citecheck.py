@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


class CiteCheck(gl.Contract):
    window: u256
    claims: TreeMap[str, str]
    ids: DynArray[str]
    open_counts: TreeMap[str, u256]
    bonds: TreeMap[str, str]
    funding: TreeMap[str, str]
    credits: TreeMap[str, u256]
    reputation: TreeMap[str, str]
    appeals: TreeMap[str, str]
    open_by_claim: TreeMap[str, str]
    appeal_keys: DynArray[str]
    attempts: TreeMap[str, str]

    def __init__(self, appeal_window_seconds: int = DEFAULT_WINDOW):
        self.window = u256(checked_window(appeal_window_seconds))

    # ---- helpers -------------------------------------------------------
    def _get(self, claim_id):
        require(claim_id in self.claims, 'claim not found')
        return json.loads(self.claims[claim_id])

    def _bond(self, claim_id):
        require(claim_id in self.bonds, 'bond not found')
        return json.loads(self.bonds[claim_id])

    def _fund(self, claim_id):
        require(claim_id in self.funding, 'no appeal funding for this claim')
        return json.loads(self.funding[claim_id])

    def _credit(self, who, amount):
        key = who.lower()
        current = int(self.credits[key]) if key in self.credits else 0
        self.credits[key] = u256(current + amount)

    def _rep(self, who, field):
        record = json.loads(self.reputation[who]) if who in self.reputation else {'released': 0, 'upheld': 0, 'overturned': 0}
        record[field] += 1
        self.reputation[who] = packed(record)

    def _open(self, claim_id):
        # Key of the open appeal for this claim, or '' (entries are blanked instead of deleted).
        return self.open_by_claim[claim_id] if claim_id in self.open_by_claim else ''

    def _close(self, claim_id):
        record = self._get(claim_id)
        if record['open']:
            record['open'] = False
            writer = record['writer']
            self.open_counts[writer] = u256(max(0, int(self.open_counts[writer]) - 1))
            self.claims[claim_id] = packed(record)

    def _append(self, claim_id, decision, reason, sources):
        record = self._get(claim_id)
        clean = {k: decision[k] for k in ('verdict', 'framing', 'about_person', 'citations', 'digests', 'quote_found')}
        record['version'] += 1
        record['sources'] = sources
        record['history'].append({'version': record['version'], 'decision': clean, 'reason': reason,
                                  'sources': sources, 'at': now()})
        self.claims[claim_id] = packed(record)

    def _settle(self, claim_id, outcome):
        fund, bond = self._fund(claim_id), self._bond(claim_id)
        require(fund['status'] == 'held' and bond['status'] == 'locked', 'nothing to settle')
        amount, stake = int(fund['amount']), int(bond['amount'])
        if outcome == 'OVERTURNED':
            # The appellant wins their deposit back plus the writer's bond.
            self._credit(fund['funder'], amount + stake)
            fund['status'], bond['status'] = 'spent', 'slashed'
            self._rep(bond['writer'], 'overturned')
            self._close(claim_id)
        elif outcome == 'UPHELD':
            # The writer keeps the bond and receives the failed appellant's deposit.
            self._credit(bond['writer'], amount)
            fund['status'] = 'forfeited'
            self._rep(bond['writer'], 'upheld')
        else:
            self._credit(fund['funder'], amount)
            fund['status'] = 'refunded'
        self.funding[claim_id] = packed(fund)
        self.bonds[claim_id] = packed(bond)

    # ---- 1. bond + claim -----------------------------------------------
    @gl.public.write.payable
    def stake(self, claim_id: str) -> None:
        require(re.fullmatch(r'[a-z0-9-]{1,48}', claim_id) is not None, 'claim id: 1-48 chars of a-z, 0-9, -')
        require(claim_id not in self.bonds, 'claim id already used')
        value = int(gl.message.value)
        require(1 * GEN <= value <= 20 * GEN, 'bond must be 1 to 20 GEN')
        stamp = now()
        self.bonds[claim_id] = packed({'id': claim_id, 'writer': str(gl.message.sender_address).lower(),
                                       'amount': str(value), 'created_at': stamp,
                                       'deadline': stamp + int(self.window), 'status': 'locked'})

    @gl.public.write
    def create_claim(self, claim_id: str, claim_url: str, claim_quote: str, evidence_json: str) -> None:
        require(claim_id not in self.claims, 'claim id already used')
        quote = ' '.join(claim_quote.split())
        require(12 <= len(quote) <= 400, 'quote the statement exactly: 12-400 characters')
        public_url(claim_url)
        urls = sources_checked(json.loads(evidence_json))
        writer = str(gl.message.sender_address).lower()
        count = int(self.open_counts[writer]) if writer in self.open_counts else 0
        require(count < 10, '10 open claims per address')
        bond = self._bond(claim_id)
        require(bond['writer'] == writer and bond['status'] == 'locked' and now() < bond['deadline'],
                'a locked bond owned by you is required first')
        decision = judgment(claim_url, quote, urls)
        require(decision['quote_found'], 'that exact statement was not found on the post page')
        require(decision['about_person'] == 'no', 'statements must be about organisations, studies or events, not private individuals')
        record = {'id': claim_id, 'writer': writer, 'claim_url': claim_url, 'claim_quote': quote,
                  'claim_fp': fingerprint(quote), 'sources': urls, 'created_at': now(),
                  'deadline': bond['deadline'], 'bond_amount': bond['amount'], 'version': 1, 'open': True,
                  'history': [{'version': 1, 'decision': decision, 'reason': 'CREATED', 'sources': urls, 'at': now()}]}
        self.claims[claim_id] = packed(record)
        self.ids.append(claim_id)
        self.open_counts[writer] = u256(count + 1)

    # ---- 2. recheck ----------------------------------------------------
    @gl.public.write
    def recheck(self, claim_id: str, extra_sources_json: str) -> None:
        claim = self._get(claim_id)
        require(self._open(claim_id) == '', 'an appeal is open; recheck after it is decided')
        extra = json.loads(extra_sources_json)
        require(type(extra) is list and len(extra) <= MAX_EVIDENCE, 'invalid added sources')
        urls = sources_checked(claim['sources'] + extra, 2 * MAX_EVIDENCE)
        key = claim_id + ':' + str(claim['version'])
        prev = json.loads(self.attempts[key]) if key in self.attempts else {'unchanged': 0, 'sources': urls}
        # After two unchanged results, the same inputs are rejected BEFORE any fetch or model call.
        require(prev['unchanged'] < 2 or urls != prev['sources'], 'two unchanged rechecks; add a new source URL')
        last = claim['history'][-1]['decision']
        decision = judgment(claim['claim_url'], claim['claim_quote'], urls)
        changed = compared(decision) != compared(last) or urls != claim['sources']
        prev['sources'] = urls
        if changed:
            self._append(claim_id, decision, 'RECHECK', urls)
        else:
            prev['unchanged'] += 1
        self.attempts[key] = packed(prev)

    # ---- 3. appeals ----------------------------------------------------
    @gl.public.write.payable
    def fund_appeal(self, claim_id: str) -> None:
        bond = self._bond(claim_id)
        require(bond['status'] == 'locked' and now() < bond['deadline'], 'the appeal window is closed')
        value = int(gl.message.value)
        require(1 * GEN <= value <= 20 * GEN, 'appeal deposit must be 1 to 20 GEN')
        if claim_id in self.funding:
            require(self._fund(claim_id)['status'] == 'refunded', 'this claim already has appeal funding')
        self.funding[claim_id] = packed({'claim_id': claim_id, 'funder': str(gl.message.sender_address).lower(),
                                         'amount': str(value), 'status': 'available'})

    @gl.public.write
    def refund_funding(self, claim_id: str) -> None:
        fund = self._fund(claim_id)
        require(fund['status'] == 'available' and fund['funder'] == str(gl.message.sender_address).lower(),
                'only the funder can refund unused funding')
        fund['status'] = 'refunded'
        self.funding[claim_id] = packed(fund)
        self._credit(fund['funder'], int(fund['amount']))

    @gl.public.write
    def contest(self, claim_id: str, counter_sources_json: str) -> None:
        claim = self._get(claim_id)
        require(claim['open'] and now() < claim['deadline'], 'the appeal window is closed')
        key = claim_id + ':' + str(claim['version'])
        require(key not in self.appeals and self._open(claim_id) == '', 'this version was already contested')
        fund = self._fund(claim_id)
        sender = str(gl.message.sender_address).lower()
        require(fund['status'] == 'available' and fund['funder'] == sender, 'your available appeal funding is required')
        require(sender != claim['writer'], 'writers cannot contest their own claim')
        counter = sources_checked(json.loads(counter_sources_json))
        fund['status'] = 'held'
        self.funding[claim_id] = packed(fund)
        self.appeals[key] = packed({'key': key, 'claim_id': claim_id, 'version': claim['version'], 'appellant': sender,
                                    'counter_sources': counter, 'status': 'open', 'ruling': '', 'created_at': now()})
        self.open_by_claim[claim_id] = key
        self.appeal_keys.append(key)

    @gl.public.write
    def judge(self, claim_id: str) -> None:
        require(self._open(claim_id) != '', 'no open appeal for this claim')
        key = self._open(claim_id)
        appeal = json.loads(self.appeals[key])
        claim = self._get(claim_id)
        require(claim['version'] == appeal['version'], 'claim version changed')
        urls = sources_checked(claim['sources'] + appeal['counter_sources'], 2 * MAX_EVIDENCE)
        decision = judgment(claim['claim_url'], claim['claim_quote'], urls)
        current = claim['history'][-1]['decision']
        reached = all(u in decision['digests'] for u in appeal['counter_sources'])
        if not reached or not decision['quote_found']:
            ruling = 'UNCERTAIN'
        elif decision['verdict'] != current['verdict']:
            ruling = 'OVERTURNED'
        else:
            ruling = 'UPHELD'
        appeal['status'], appeal['ruling'], appeal['decided_at'] = 'decided', ruling, now()
        appeal['label'] = decision['verdict']
        self.appeals[key] = packed(appeal)
        self.open_by_claim[claim_id] = ''
        if ruling == 'OVERTURNED':
            self._append(claim_id, decision, 'APPEAL', urls)
        self._settle(claim_id, ruling)

    @gl.public.write
    def cancel_stale(self, claim_id: str) -> None:
        # Liveness: an appeal nobody judged within 24h of the claim deadline is cancelled and refunded.
        require(self._open(claim_id) != '', 'no open appeal for this claim')
        claim = self._get(claim_id)
        require(now() >= claim['deadline'] + 24 * 3600, 'appeal is not stale yet')
        key = self._open(claim_id)
        appeal = json.loads(self.appeals[key])
        appeal['status'], appeal['ruling'], appeal['decided_at'] = 'cancelled', 'UNCERTAIN', now()
        self.appeals[key] = packed(appeal)
        self.open_by_claim[claim_id] = ''
        self._settle(claim_id, 'UNCERTAIN')

    # ---- 4. bonds out --------------------------------------------------
    @gl.public.write
    def release(self, claim_id: str) -> None:
        bond = self._bond(claim_id)
        require(bond['status'] == 'locked', 'bond is not locked')
        require(now() >= bond['deadline'], 'the appeal window is still open')
        require(claim_id in self.claims, 'no claim was filed; use reclaim')
        require(self._open(claim_id) == '', 'an appeal is in progress')
        bond['status'] = 'released'
        self.bonds[claim_id] = packed(bond)
        self._credit(bond['writer'], int(bond['amount']))
        self._rep(bond['writer'], 'released')
        self._close(claim_id)

    @gl.public.write
    def reclaim(self, claim_id: str) -> None:
        # Recover a bond when the claim was never filed (for example the quote was not found on the page).
        bond = self._bond(claim_id)
        require(bond['status'] == 'locked', 'bond is not locked')
        require(now() >= bond['created_at'] + 600, 'wait 10 minutes after staking')
        require(claim_id not in self.claims, 'a claim was filed; use release')
        bond['status'] = 'cancelled'
        self.bonds[claim_id] = packed(bond)
        self._credit(bond['writer'], int(bond['amount']))

    @gl.public.write
    def withdraw(self) -> None:
        key = str(gl.message.sender_address).lower()
        amount = int(self.credits[key]) if key in self.credits else 0
        require(amount > 0, 'nothing to withdraw')
        self.credits[key] = u256(0)
        _Recipient(gl.message.sender_address).emit_transfer(value=u256(amount))

    # ---- views ---------------------------------------------------------
    @gl.public.view
    def has_claim(self, claim_id: str) -> bool:
        return claim_id in self.claims

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        return packed(self._get(claim_id))

    @gl.public.view
    def get_count(self) -> int:
        return len(self.ids)

    @gl.public.view
    def list_claims(self, offset: int, limit: int) -> str:
        require(offset >= 0 and 1 <= limit <= 25, 'page limit 1-25')
        ids = list(self.ids)
        ids.reverse()
        return '[' + ','.join(self.claims[i] for i in ids[offset:offset + limit]) + ']'

    @gl.public.view
    def get_bond(self, claim_id: str) -> str:
        return packed(self._bond(claim_id))

    @gl.public.view
    def get_funding(self, claim_id: str) -> str:
        return packed(self._fund(claim_id)) if claim_id in self.funding else ''

    @gl.public.view
    def get_appeal(self, claim_id: str, version: int) -> str:
        key = claim_id + ':' + str(version)
        return self.appeals[key] if key in self.appeals else ''

    @gl.public.view
    def has_open_appeal(self, claim_id: str) -> bool:
        return self._open(claim_id) != ''

    @gl.public.view
    def get_credit(self, account: str) -> str:
        key = account.lower()
        return str(int(self.credits[key])) if key in self.credits else '0'

    @gl.public.view
    def get_reputation(self, account: str) -> str:
        key = account.lower()
        return self.reputation[key] if key in self.reputation else packed({'released': 0, 'upheld': 0, 'overturned': 0})

    @gl.public.view
    def get_config(self) -> str:
        return packed({'window': int(self.window), 'min_gen': 1, 'max_gen': 20})
