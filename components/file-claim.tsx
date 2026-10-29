"use client";
import { useEffect, useMemo, useState } from "react";
import { ADDR } from "@/lib/contracts";
import { makeClaimId, parseUrls, toWei, validPublicUrl } from "@/lib/domain";
import { useTx } from "@/lib/tx";
import { useWallet } from "@/lib/wallet";

interface Pending { id: string; url: string; quote: string; evidence: string[] }
const KEY = "fp:pending";

/** Two paid steps: lock a bond (Bonds.stake), then file the claim (Claims.create_claim). */
export function FileClaim({ live, onFiled }: { live: boolean; onFiled: () => void }) {
  const wallet = useWallet();
  const tx = useTx();
  const [url, setUrl] = useState("");
  const [quote, setQuote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [stake, setStake] = useState(2);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const p = JSON.parse(raw) as Pending; setPending(p); setUrl(p.url); setQuote(p.quote); setEvidence(p.evidence.join("\n")); }
    } catch { /* storage unavailable */ }
  }, []);
  const remember = (p: Pending | null) => {
    setPending(p);
    try { if (p) localStorage.setItem(KEY, JSON.stringify(p)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  };

  const urls = useMemo(() => parseUrls(evidence), [evidence]);
  const problem = useMemo(() => {
    if (!validPublicUrl(url)) return "Post URL must be a public https URL.";
    const q = quote.trim().replace(/\s+/g, " ");
    if (q.length < 12 || q.length > 400) return "Copy the statement exactly (12 to 400 characters).";
    if (urls.length < 1 || urls.length > 4) return "Add 1 to 4 cited source URLs.";
    if (!urls.every(validPublicUrl)) return "Every cited source URL must be a public https URL.";
    return null;
  }, [url, quote, urls]);

  async function lockBond() {
    if (problem || busy) return;
    setBusy(true);
    const p: Pending = { id: makeClaimId(url, quote), url: url.trim(), quote: quote.trim().replace(/\s+/g, " "), evidence: urls };
    const ok = await tx.send("Lock bond", { address: ADDR.main, method: "stake", args: [p.id], value: toWei(stake) });
    if (ok) remember(p);
    setBusy(false);
  }
  async function file() {
    if (!pending || busy || problem) return;
    setBusy(true);
    // The bond is keyed only by its id, so the text can be corrected and resubmitted without re-staking.
    const next: Pending = { id: pending.id, url: url.trim(), quote: quote.trim().replace(/\s+/g, " "), evidence: urls };
    remember(next);
    setNote(null);
    const ok = await tx.send("File check", { address: ADDR.main, method: "create_claim", args: [next.id, next.url, next.quote, JSON.stringify(next.evidence)] });
    if (ok) {
      // Confirm the check is really on-chain; an accepted transaction can still be a contract rejection.
      let filed = false;
      for (let i = 0; i < 6 && !filed; i++) {
        try { filed = (await fetch(`/api/claims/${encodeURIComponent(next.id)}`, { cache: "no-store" })).ok; } catch { /* retry */ }
        if (!filed) await new Promise((r) => setTimeout(r, 2500));
      }
      if (filed) { remember(null); setUrl(""); setQuote(""); setEvidence(""); onFiled(); }
      else setNote("Validators accepted the transaction, but the contract did not file the check. Most often the statement is not word for word on the post page. Edit it and try again; your bond stays locked.");
    }
    setBusy(false);
  }
  async function reclaim() {
    if (!pending || busy) return;
    setBusy(true);
    const ok = await tx.send("Reclaim bond", { address: ADDR.main, method: "reclaim", args: [pending.id] });
    if (ok) remember(null);
    setBusy(false);
  }

  const disabled = !live || !wallet.account;
  return (
    <div className="card panel sticky">
      <h3>File a <em>check</em></h3>
      <div className="stepper"><span className={pending ? "done" : "on"}>1 · lock bond</span><span className={pending ? "on" : ""}>2 · validators judge</span></div>
      <div className="field"><label>post url (where the statement appears)</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://news.example/article" /></div>
      <div className="field"><label>the statement, copied exactly</label><textarea value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="The city cut emissions by 40% since 2015" /></div>
      <div className="field"><label>cited source urls (1 to 4, one per line)</label><textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={"https://data.city.example/emissions-report"} /></div>
      {pending ? (
        <>
          <p className="hint">Bond locked for <b className="mono">{pending.id}</b>. If validators reject the check, the usual cause is a statement that isn’t word for word on the post page. Edit the fields above and try again; your bond stays locked.</p>
          {problem && <span className="err-text">{problem}</span>}
          <button className="btn primary" onClick={file} disabled={busy || !live || !!problem}>{busy ? "Working…" : "Ask validators to judge →"}</button>
          <button className="btn ghost sm" onClick={reclaim} disabled={busy || !live}>Cancel and reclaim bond (after 10 min)</button>
        </>
      ) : (
        <>
          <div className="field"><label>bond · {stake} GEN</label><input type="range" min={1} max={20} step={1} value={stake} onChange={(e) => setStake(Number(e.target.value))} /></div>
          {(url || quote || evidence) && problem && <span className="err-text">{problem}</span>}
          <button className="btn primary" onClick={wallet.account ? lockBond : wallet.connect} disabled={busy || !live || (!!wallet.account && !!problem)}>
            {!wallet.account ? "Connect wallet to start" : busy ? "Working…" : `Lock ${stake} GEN bond →`}
          </button>
        </>
      )}
      {note && <span className="err-text">{note}</span>}
      {!live && <p className="hint">Contracts are not deployed yet. Run the deploy script, then set the addresses.</p>}
      {live && disabled && !pending && <p className="hint">Writes need a connected wallet on Studio.</p>}
      {wallet.error && <span className="err-text">{wallet.error}</span>}
    </div>
  );
}
