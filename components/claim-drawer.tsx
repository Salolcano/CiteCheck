"use client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ADDR } from "@/lib/contracts";
import { current, VERDICT_META, fmtGen, hostOf, parseUrls, shortAddr, timeAgo, timeLeft, toWei, validPublicUrl,
  type Appeal, type Bond, type Claim, type Funding } from "@/lib/domain";
import { useNowSec } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { useWallet } from "@/lib/wallet";
import { VerdictChip, FramingChip } from "./ui";

interface Detail { claim: Claim; bond: Bond | null; funding: Funding | null; appeal: Appeal | null; openAppeal: boolean }

export function ClaimDrawer({ seed, live, onClose, onChanged }: { seed: Claim; live: boolean; onClose: () => void; onChanged: () => void }) {
  const wallet = useWallet();
  const tx = useTx();
  const now = useNowSec(15000) ?? Math.floor(Date.now() / 1000);
  const [detail, setDetail] = useState<Detail>({ claim: seed, bond: null, funding: null, appeal: null, openAppeal: false });
  const [extra, setExtra] = useState("");
  const [counter, setCounter] = useState("");
  const [deposit, setDeposit] = useState(2);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!live) return;
    try {
      const r = await fetch(`/api/claims/${encodeURIComponent(seed.id)}`, { cache: "no-store" });
      const j = await r.json();
      if (j.claim) setDetail({ claim: j.claim, bond: j.bond, funding: j.funding, appeal: j.appeal, openAppeal: !!j.openAppeal });
    } catch { /* keep last good state */ }
  }, [live, seed.id]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const { claim, bond, funding, appeal, openAppeal } = detail;
  const d = current(claim);
  const me = wallet.account;
  const isWriter = !!me && me === claim.writer;
  const windowOpen = now < claim.deadline;
  const act = async (label: string, address: typeof ADDR.main, method: string, args: (string | number)[], value?: bigint) => {
    setBusy(true);
    const ok = await tx.send(label, { address, method, args, value });
    if (ok) { await load(); onChanged(); }
    setBusy(false);
    return ok;
  };
  const extraUrls = parseUrls(extra), counterUrls = parseUrls(counter);
  const extraOk = extraUrls.length <= 4 && extraUrls.every(validPublicUrl);
  const counterOk = counterUrls.length >= 1 && counterUrls.length <= 4 && counterUrls.every(validPublicUrl);
  const myFunding = funding && me && funding.funder === me;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Claim detail">
        <div className="drawer-top"><span className="eyebrow">claim · {claim.id}</span><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="row"><VerdictChip label={d.verdict} /><FramingChip label={d.framing} /><span className="kv">v<b>{claim.version}</b></span></div>
        <h2>“{claim.claim_quote}”</h2>
        <a className="kv" href={claim.claim_url} target="_blank" rel="noreferrer noopener">{hostOf(claim.claim_url)} ↗</a>
        <p className="hint" style={{ marginTop: 10 }}>{VERDICT_META[d.verdict].blurb}{!d.quote_found && " The statement is no longer on the post page."}</p>
        <div className="row kv" style={{ marginTop: 6 }}>
          <span>writer <b>{shortAddr(claim.writer)}</b></span><span>bond <b>{fmtGen(claim.bond_amount)} GEN</b></span>
          <span>{claim.open ? <b>{timeLeft(claim.deadline, now)}</b> : <b>settled</b>}</span>{bond && <span>bond status <b>{bond.status}</b></span>}
        </div>

        <div className="block"><h4>what the cited source says</h4>
          {d.citations.length === 0 && <p className="hint">No citations. “Not found” is a valid verdict: the cited sources do not contain it.</p>}
          {d.citations.map((c, i) => (
            <div key={i} className="card cite"><q>{c.quote}</q><a href={c.url} target="_blank" rel="noreferrer noopener">{c.url}</a></div>
          ))}
        </div>

        <div className="block"><h4>version history · append only</h4>
          <div className="timeline">
            {[...claim.history].reverse().map((v, i, arr) => {
              const prev = arr[i + 1]?.decision.verdict;
              return (
                <div key={v.version} className="tl" style={{ ["--c" as string]: VERDICT_META[v.decision.verdict].color } as CSSProperties}>
                  <small>v{v.version} · {v.reason.toLowerCase()} · {timeAgo(v.at, now)}</small>
                  <VerdictChip label={v.decision.verdict} />
                  {prev && prev !== v.decision.verdict && <span className="kv" style={{ marginLeft: 8 }}>was {VERDICT_META[prev].name.toLowerCase()}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="block"><h4>sources</h4>
          {claim.sources.map((s) => <div key={s}><a className="kv" href={s} target="_blank" rel="noreferrer noopener">{s}</a></div>)}
        </div>

        {live && (
          <div className="block"><h4>actions</h4>
            {claim.open && !openAppeal && (
              <div className="card action"><h5>Recheck the sources</h5>
                <p className="hint">Re-reads the post and its cited sources (plus any new URLs). A changed verdict is appended as a new version.</p>
                <textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Optional extra source URLs, one per line" />
                {!extraOk && extra && <span className="err-text">Up to 4 public https URLs.</span>}
                <button className="btn sm primary" disabled={busy || !extraOk || !me} onClick={() => act("Recheck sources", ADDR.main, "recheck", [claim.id, JSON.stringify(extraUrls)])}>{me ? "Recheck →" : "Connect wallet"}</button>
              </div>
            )}
            {claim.open && windowOpen && !isWriter && !appeal && !openAppeal && (
              <div className="card action"><h5>Contest this verdict</h5>
                {(!funding || funding.status === "refunded") ? (<>
                  <p className="hint">Step 1: lock an appeal deposit. If you win you receive it back plus the writer’s bond. If you lose, the writer keeps it.</p>
                  <div className="field"><label>deposit · {deposit} GEN</label><input type="range" min={1} max={20} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} /></div>
                  <button className="btn sm primary" disabled={busy || !me} onClick={() => act("Fund appeal", ADDR.main, "fund_appeal", [claim.id], toWei(deposit))}>{me ? `Lock ${deposit} GEN deposit →` : "Connect wallet"}</button>
                </>) : funding.status === "available" && myFunding ? (<>
                  <p className="hint">Step 2: supply the sources you think are right. Validators re-judge the post with them added.</p>
                  <textarea value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="Source URLs (1 to 4), one per line" />
                  {!counterOk && counter && <span className="err-text">1 to 4 public https URLs.</span>}
                  <div className="row">
                    <button className="btn sm primary" disabled={busy || !counterOk} onClick={() => act("Open appeal", ADDR.main, "contest", [claim.id, JSON.stringify(counterUrls)])}>Open appeal →</button>
                    <button className="btn sm ghost" disabled={busy} onClick={() => act("Refund deposit", ADDR.main, "refund_funding", [claim.id])}>Refund deposit</button>
                  </div>
                </>) : <p className="hint">An appeal deposit already exists for this claim ({funding.status}).</p>}
              </div>
            )}
            {openAppeal && (
              <div className="card action"><h5>Appeal in progress</h5>
                <p className="hint">Anyone can ask validators to rule. The deposit must have finalized first; if the call says so, retry in a moment.</p>
                <button className="btn sm red" disabled={busy || !me} onClick={() => act("Request ruling", ADDR.main, "judge", [claim.id])}>{me ? "Request ruling →" : "Connect wallet"}</button>
              </div>
            )}
            {appeal && !openAppeal && (
              <div className="card action"><h5>Appeal ruled: {appeal.ruling || appeal.status}</h5>
                <p className="hint">{appeal.ruling === "OVERTURNED" ? "The verdict was changed and the writer’s bond was paid to the appellant." : appeal.ruling === "UPHELD" ? "The verdict stands; the writer received the appellant’s deposit." : "Inconclusive; the deposit was refunded."}</p>
              </div>
            )}
            {bond?.status === "locked" && !windowOpen && !openAppeal && (
              <div className="card action"><h5>Appeal window closed</h5>
                <p className="hint">Release the bond so the writer can withdraw it.</p>
                <button className="btn sm primary" disabled={busy || !me} onClick={() => act("Release bond", ADDR.main, "release", [claim.id])}>Release bond →</button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
