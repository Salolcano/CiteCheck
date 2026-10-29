import json, pytest
from tests.direct import stub
from tests.direct.stub import gl, call, deploy, REGISTRY, TRANSFERS

GEN = 10 ** 18
DEV, ALICE, BOB = '0xdev', '0xalice', '0xbob'
PAGE = 'https://acme.example/pricing'
EVID = 'https://status.acme.example/history'
AUDIT = 'https://audit.example/report'
QUOTE = '99.99% uptime guaranteed'
CID = 'acme-uptime'


class W:
    pass


@pytest.fixture()
def world():
    REGISTRY.clear(); TRANSFERS.clear(); stub.QUEUE.clear()
    gl.message_raw['datetime'] = '2026-10-18T10:00:00Z'
    w = W()
    w.mod = stub.load('citecheck')
    w.f = deploy(w.mod, 'CiteCheck', '0xfp', DEV, 900)
    return w


def decision(label='PARTIAL', hype='OVERSTATED', found=True, cites=None, digests=None):
    cites = [{'url': EVID, 'quote': 'uptime was 97.1% in March because of an outage'}] if cites is None else cites
    return {'verdict': label, 'framing': hype, 'about_person': 'no', 'citations': cites,
            'digests': digests or {PAGE: 'a', EVID: 'b'}, 'quote_found': found}


def judge_with(w, d):
    w.mod.judgment = lambda url, quote, urls, _d=d: _d


def at(ts):
    gl.message_raw['datetime'] = ts


def file_claim(w, d=None, cid=CID):
    judge_with(w, d or decision())
    call(w.f, 'stake', (cid,), sender=ALICE, value=2 * GEN)
    call(w.f, 'create_claim', (cid, PAGE, QUOTE, json.dumps([EVID])), sender=ALICE)


def claim(w):
    return json.loads(w.f.get_claim(CID))


def test_create_and_read(world):
    file_claim(world)
    rec = claim(world)
    assert rec['version'] == 1 and rec['history'][0]['decision']['verdict'] == 'PARTIAL'
    assert rec['bond_amount'] == str(2 * GEN)
    assert json.loads(world.f.list_claims(0, 5))[0]['id'] == CID and world.f.get_count() == 1


def test_requires_bond_and_valid_inputs(world):
    judge_with(world, decision())
    with pytest.raises(stub.UserError):
        call(world.f, 'create_claim', ('x1', PAGE, QUOTE, json.dumps([EVID])), sender=ALICE)
    call(world.f, 'stake', ('x1',), sender=ALICE, value=2 * GEN)
    for bad in ('http://acme.example', 'https://127.0.0.1/a'):
        with pytest.raises(stub.UserError):
            call(world.f, 'create_claim', ('x1', bad, QUOTE, json.dumps([EVID])), sender=ALICE)
    with pytest.raises(stub.UserError):
        call(world.f, 'stake', ('x2',), sender=ALICE, value=50 * GEN)
    with pytest.raises(stub.UserError):
        call(world.f, 'stake', ('x3',), sender=ALICE, value=0)


def test_quote_not_on_page_is_rejected_then_bond_reclaimed(world):
    judge_with(world, decision(found=False))
    call(world.f, 'stake', ('ghost',), sender=ALICE, value=3 * GEN)
    with pytest.raises(stub.UserError):
        call(world.f, 'create_claim', ('ghost', PAGE, QUOTE, json.dumps([EVID])), sender=ALICE)
    with pytest.raises(stub.UserError):
        call(world.f, 'reclaim', ('ghost',), sender=ALICE)
    at('2026-10-18T10:11:00Z')
    call(world.f, 'reclaim', ('ghost',), sender=BOB)
    call(world.f, 'withdraw', (), sender=ALICE)
    assert TRANSFERS == [(ALICE, 3 * GEN)]


def test_recheck_appends_version_and_unchanged_is_rate_limited(world):
    file_claim(world)
    judge_with(world, decision('MISREPRESENTS', 'OVERSTATED', cites=[{'url': EVID, 'quote': 'uptime was 97.1% in March'}]))
    call(world.f, 'recheck', (CID, '[]'), sender=BOB)
    rec = claim(world)
    assert rec['version'] == 2 and rec['history'][1]['reason'] == 'RECHECK'
    assert rec['history'][0]['decision']['verdict'] == 'PARTIAL'  # history is immutable
    judge_with(world, rec['history'][1]['decision'])
    for _ in range(2):
        call(world.f, 'recheck', (CID, '[]'), sender=BOB)
    assert claim(world)['version'] == 2
    with pytest.raises(stub.UserError):
        call(world.f, 'recheck', (CID, '[]'), sender=BOB)
    call(world.f, 'recheck', (CID, json.dumps([AUDIT])), sender=BOB)  # a new source is allowed again


def open_appeal(w, who=BOB, deposit=2):
    call(w.f, 'fund_appeal', (CID,), sender=who, value=deposit * GEN)
    call(w.f, 'contest', (CID, json.dumps([AUDIT])), sender=who)


def test_appeal_overturned_pays_appellant_and_updates_verdict(world):
    file_claim(world)
    open_appeal(world)
    with pytest.raises(stub.UserError):  # recheck blocked while appeal is open
        call(world.f, 'recheck', (CID, '[]'), sender=ALICE)
    d = decision('SUPPORTS', 'FAIR', cites=[{'url': EVID, 'quote': 'uptime was 99.995% across the year'}],
                 digests={PAGE: 'a', EVID: 'b', AUDIT: 'c'})
    judge_with(world, d)
    call(world.f, 'judge', (CID,), sender=ALICE)
    assert json.loads(world.f.get_appeal(CID, 1))['ruling'] == 'OVERTURNED'
    rec = claim(world)
    assert rec['version'] == 2 and rec['history'][-1]['reason'] == 'APPEAL' and rec['open'] is False
    assert world.f.get_credit(BOB) == str(4 * GEN)
    call(world.f, 'withdraw', (), sender=BOB)
    assert TRANSFERS == [(BOB, 4 * GEN)]
    with pytest.raises(stub.UserError):
        call(world.f, 'withdraw', (), sender=BOB)  # pull payment is single-use


def test_appeal_upheld_pays_writer_and_bond_released_after_deadline(world):
    file_claim(world)
    open_appeal(world, deposit=1)
    judge_with(world, decision(digests={PAGE: 'a', EVID: 'b', AUDIT: 'c'}))
    call(world.f, 'judge', (CID,), sender=ALICE)
    assert json.loads(world.f.get_appeal(CID, 1))['ruling'] == 'UPHELD'
    assert world.f.get_credit(ALICE) == str(1 * GEN)
    with pytest.raises(stub.UserError):
        call(world.f, 'release', (CID,), sender=ALICE)  # window still open
    at('2026-10-18T10:16:00Z')
    call(world.f, 'release', (CID,), sender=ALICE)
    assert world.f.get_credit(ALICE) == str(3 * GEN)
    assert json.loads(world.f.get_reputation(ALICE))['upheld'] == 1 and claim(world)['open'] is False


def test_appeal_uncertain_refunds(world):
    file_claim(world)
    open_appeal(world, deposit=1)
    judge_with(world, decision())  # counter-evidence unreachable -> UNCERTAIN
    call(world.f, 'judge', (CID,), sender=ALICE)
    assert json.loads(world.f.get_appeal(CID, 1))['ruling'] == 'UNCERTAIN'
    assert world.f.get_credit(BOB) == str(1 * GEN)


def test_writer_cannot_self_appeal_and_funding_refund(world):
    file_claim(world)
    call(world.f, 'fund_appeal', (CID,), sender=ALICE, value=1 * GEN)
    with pytest.raises(stub.UserError):
        call(world.f, 'contest', (CID, json.dumps([AUDIT])), sender=ALICE)
    call(world.f, 'refund_funding', (CID,), sender=ALICE)
    assert world.f.get_credit(ALICE) == str(1 * GEN)
    with pytest.raises(stub.UserError):
        call(world.f, 'refund_funding', (CID,), sender=ALICE)


def test_cancel_stale_appeal(world):
    file_claim(world)
    open_appeal(world, deposit=1)
    with pytest.raises(stub.UserError):
        call(world.f, 'cancel_stale', (CID,), sender=ALICE)
    at('2026-10-19T11:00:00Z')
    call(world.f, 'cancel_stale', (CID,), sender=ALICE)
    assert world.f.get_credit(BOB) == str(1 * GEN)


def test_appeal_blocked_after_window_and_cannot_release_early_or_twice(world):
    file_claim(world)
    at('2026-10-18T10:16:00Z')
    with pytest.raises(stub.UserError):
        call(world.f, 'fund_appeal', (CID,), sender=BOB, value=1 * GEN)
    call(world.f, 'release', (CID,), sender=ALICE)
    with pytest.raises(stub.UserError):
        call(world.f, 'release', (CID,), sender=ALICE)
    assert world.f.get_credit(ALICE) == str(2 * GEN)
