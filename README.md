# Cite Check

> Does the source really say that? Check the citation. Get paid when you're right.

Cite Check judges whether the source a post cites actually supports what the post says. Someone files a **statement**, the
**post URL** where it appears, and one to four **cited source URLs**. GenLayer validators independently fetch the pages and agree
on a verdict (`SUPPORTS · PARTIAL · MISREPRESENTS · NOT_FOUND`) and a separate framing label (`FAIR · OVERSTATED · UNCLEAR`).
Every quote must appear word for word in each validator's own copy of the page. Writers stake 1–20 GEN, verdicts are
append-only, and anyone can recheck with new sources or appeal with a deposit. **Network: GenLayer Studio (chain 61999).**

One Intelligent Contract (`contracts/citecheck.py`) holds four modules: **Claims, Recheck, Bonds, Appeals**. A Next.js app
(`app/`, `components/`, `lib/`) reads state through server routes and sends wallet-signed writes through `genlayer-js`.
See `docs/ARCHITECTURE.md`.

## Quick start (developers)
```bash
npm install
cp .env.example .env.local
python scripts/build-contracts.py                              # regenerates contracts/citecheck.py from contracts-src/
pip install -r requirements.txt && python -m pytest tests/direct -q   # contract logic tests (stubbed GenVM)
npm test && npm run dev                                        # http://localhost:3117 (demo data until deployed)
```

## 1 · Deploy the contract to Studio (no code needed)
Open the GenLayer Studio, connect a wallet on chain 61999, create a contract tab, paste the contents of
`contracts/citecheck.py`, set the constructor input `appeal_window_seconds` to `900` (15 min, good for demos), click Deploy
and **copy the contract address**. There is nothing to wire.

## 2 · Deploy the app to Vercel
1. Push this folder to GitHub, then Vercel → **Add New → Project** → import the repo (Next.js is auto-detected) → **Deploy**.
2. **Settings → Environment Variables:** add `NEXT_PUBLIC_CONTRACT_ADDRESS` = your contract address
   (optional: `NEXT_PUBLIC_GENLAYER_RPC`, `NEXT_PUBLIC_EXPLORER_URL`). Then **Deployments → ⋯ → Redeploy**.
3. Open the site, connect a wallet on Studio, lock a bond and file a check.

## Demo (≈3 min)
Post URL `https://www.iana.org/help/example-domains` · statement `These domains may be used as illustrative examples in documents without prior coordination with us.` · cited source `https://en.wikipedia.org/wiki/Example.com`.
Lock the bond, ask validators to judge, open the check, add a source and **Recheck**, then appeal from a second wallet.

## Troubleshooting
- **"that exact statement was not found on the post page"**: copy the statement word for word (case-sensitive); edit it in the form and retry, your bond stays locked.
- **Vercel shows demo data**: `NEXT_PUBLIC_CONTRACT_ADDRESS` is missing; add it and redeploy.
