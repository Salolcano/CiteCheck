# Architecture

```
Browser ──wallet-signed writes (genlayer-js: estimate fees → write → receipt)──▶ GenLayer Studio (61999)
   │                                                                              ▲
   └──▶ Next.js API routes (read-only, genlayer-js readContract) ──────────────────┘
```

One Intelligent Contract (`CiteCheck`) with four modules:

| Module | Responsibility |
|---|---|
| **Claims** | Stores each claim and its append-only version history. `create_claim` runs validator consensus on the page + evidence. |
| **Recheck** | Re-judges a claim with optional extra evidence; a changed verdict is appended as a new version. Two unchanged results block identical inputs before any fetch. |
| **Bonds** | Writer bonds (1–20 GEN), appeal deposits, credits and pull-payment withdrawals. |
| **Appeals** | One contest per claim version. `judge` re-runs consensus with counter-evidence and rules UPHELD / OVERTURNED / UNCERTAIN, settles funds and (if overturned) appends a version. `cancel_stale` refunds unjudged appeals. |

## Consensus rule
The leader and each validator fetch the post and the cited sources themselves and ask an LLM for
`{verdict, framing, about_person, citations}`. Every cited quote must appear **verbatim** in that node's own fetched copy
of a **cited source** (the post can never vouch for itself); invalid citations are dropped, and a verdict without a grounded
citation collapses to `NOT_FOUND`. Validators agree when `(verdict, about_person, quote_found)` match; `quote_found` means the
statement itself appears on the post page. Framing is the leader's, restricted to FAIR / OVERSTATED / UNCLEAR.

## Money flow
- Writer: `stake` → `create_claim` → after the window, `release` → `withdraw`.
- Appellant: `fund_appeal` → `contest` → `judge`.
  OVERTURNED → appellant gets deposit + writer bond. UPHELD → writer gets the deposit. UNCERTAIN → deposit refunded.
- All payouts are credits; `withdraw` zeroes the credit before the transfer (pull payments).

## Safety
Only public `https` hostnames are accepted (no IPs, ports, credentials, private TLDs). Page text is treated as untrusted data in the prompt.
Claims about identifiable private individuals are rejected. Labels describe supplied sources; they do not establish objective truth.
