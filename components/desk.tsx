"use client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ADDR, isLive } from "@/lib/contracts";
import { VERDICT_META, VERDICT_ORDER, current, fmtGen, hostOf, summarize, type Claim, type Verdict, type Reputation } from "@/lib/domain";
import { useTx } from "@/lib/tx";
import { useWallet } from "@/lib/wallet";
import { ClaimCard } from "./claim-card";
import { ClaimDrawer } from "./claim-drawer";
import { FileClaim } from "./file-claim";
import { ConnectButton, SiteNav } from "./nav";
import { Counter } from "./ui";

interface Feed { live: boolean; claims: Claim[]; error?: string }
type Filter = Verdict | "ALL" | "OVERSTATED" | "MINE";

function AccountPanel({ live, claims, onChanged }: { live: boolean; claims: Claim[]; onChanged: () => void }) {
  const { account } = useWallet();
  const tx = useTx();
  const [acct, setAcct] = useState<{ credit: string; reputation: Reputation } | null>(null);
  const load = useCallback(async () => {
    if (!account || !live) return setAcct(null);
    try { const j = await (await fetch(`/api/account?address=${account}`, { cache: "no-store" })).json(); if (j.credit !== undefined) setAcct(j); } catch { /* ignore */ }
  }, [account, live]);
  useEffect(() => { load(); const t = setInterval(load, 12000); return () => clearInterval(t); }, [load]);
  if (!account) return null;
  const credit = BigInt(acct?.credit ?? "0");
  const mine = claims.filter((c) => c.writer === account).length;
  return (
    <div className="card panel">
      <h3>My <em>desk</em></h3>
      <div className="mini-row"><span>Withdrawable</span><b>{fmtGen(credit)} GEN</b></div>
      <button className="btn sm primary" disabled={credit === 0n || !live}
        onClick={async () => { if (await tx.send("Withdraw", { address: ADDR.main, method: "withdraw", args: [] })) { load(); onChanged(); } }}>Withdraw to wallet</button>
      <div className="mini-row"><span>Claims filed</span><b>{mine}</b></div>
      <div className="mini-row"><span>Bonds released · appeals upheld · overturned</span><b>{acct ? `${acct.reputation.released} · ${acct.reputation.upheld} · ${acct.reputation.overturned}` : "–"}</b></div>
    </div>
  );
}

export default function Desk() {
  const { account } = useWallet();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await (await fetch("/api/claims", { cache: "no-store" })).json();
      setFeed({ live: !!j.live, claims: j.claims ?? [], error: j.error });
    } catch { setFeed((f) => ({ live: isLive, claims: f?.claims ?? [], error: "Could not reach the app server." })); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const claims = feed?.claims ?? [];
  const live = !!feed?.live;
  const stats = useMemo(() => summarize(claims), [claims]);
  const shown = useMemo(() => claims.filter((c) => {
    const d = current(c);
    if (filter === "MINE" && c.writer !== account) return false;
    if (filter === "OVERSTATED" && d.framing !== "OVERSTATED") return false;
    if ((VERDICT_ORDER as string[]).includes(filter) && d.verdict !== filter) return false;
    const s = q.trim().toLowerCase();
    return !s || c.claim_quote.toLowerCase().includes(s) || hostOf(c.claim_url).includes(s);
  }), [claims, filter, q, account]);
  const open = claims.find((c) => c.id === openId);
  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  return (
    <>
      <SiteNav desk right={<ConnectButton />} />
      <main className="wrap">
        <section className="desk-head">
          <span className="eyebrow">the desk · studio</span>
          <h1 className="display" style={{ marginTop: 12 }}>Every citation, <em>checked.</em></h1>
          {feed && !live && <div className="banner"><b>Demo data.</b> These sample checks are fictional. Deploy the contracts and set their addresses to go live.</div>}
          {feed?.error && <div className="banner err">{feed.error} Showing the last known state.</div>}
          <div className="kpis">
            <div className="card kpi"><small>statements checked</small><b><Counter value={stats.total} /></b></div>
            <div className="card kpi"><small>supported</small><b><Counter value={pct(stats.counts.SUPPORTS)} /><span>%</span></b></div>
            <div className="card kpi"><small>partial or misrepresented</small><b><Counter value={pct(stats.counts.MISREPRESENTS + stats.counts.PARTIAL)} /><span>%</span></b></div>
            <div className="card kpi"><small>GEN at stake</small><b><Counter value={Number(fmtGen(stats.staked))} decimals={0} /></b></div>
          </div>
          <div className="card dist">
            <small className="eyebrow">verdict mix</small>
            <div className="dist-bar">{VERDICT_ORDER.map((k) => <div key={k} className="dist-seg" style={{ flex: stats.counts[k] || 0.0001, ["--c" as string]: VERDICT_META[k].color } as CSSProperties} />)}</div>
            <div className="legend">{VERDICT_ORDER.map((k) => <span key={k} style={{ ["--c" as string]: VERDICT_META[k].color } as CSSProperties}><i />{VERDICT_META[k].name} {stats.counts[k]}</span>)}<span><i style={{ borderRadius: 2, background: "var(--ink2)" }} />Overstated {stats.overstated}</span></div>
          </div>
        </section>

        <div className="desk-grid">
          <section>
            <div className="filters">
              {(["ALL", ...VERDICT_ORDER, "OVERSTATED", "MINE"] as Filter[]).map((f) => (
                <button key={f} className={`fchip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{f === "ALL" ? "all" : f === "MINE" ? "mine" : f === "OVERSTATED" ? "overstated" : VERDICT_META[f].name.toLowerCase()}</button>
              ))}
              <input className="search" placeholder="search statements or domains" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search statements" />
            </div>
            <div className="feed">
              {!feed && [0, 1, 2].map((i) => <div key={i} className="skeleton" />)}
              {feed && shown.length === 0 && <div className="card empty">{claims.length === 0 ? "No checks yet. File the first one." : "Nothing matches this filter."}</div>}
              {shown.map((c, i) => <ClaimCard key={c.id} claim={c} delay={Math.min(i, 8) * 0.05} onOpen={setOpenId} />)}
            </div>
          </section>
          <aside style={{ display: "grid", gap: 18 }}>
            <FileClaim live={live} onFiled={load} />
            <AccountPanel live={live} claims={claims} onChanged={load} />
          </aside>
        </div>
      </main>
      {open && <ClaimDrawer key={open.id} seed={open} live={live} onClose={() => setOpenId(null)} onChanged={load} />}
    </>
  );
}
