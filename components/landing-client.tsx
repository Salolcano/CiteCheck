"use client";
import { useEffect, useState, type CSSProperties } from "react";

const EXAMPLES = [
  { host: "newsdesk.example/city-climate", headline: "The city cut emissions by 40% since 2015", fine: "[1] data.city.example: “…emissions fell 14% between 2015 and 2023.”", label: "Misrepresents", color: "var(--red)", cite: "“…emissions fell 14% between 2015 and 2023.”" },
  { host: "wellblog.example/walk", headline: "A new study shows daily walking lowers stress", fine: "[1] journal.example: “…participants who walked daily reported lower stress scores.”", label: "Supports", color: "var(--green)", cite: "“participants who walked daily reported lower stress scores”" },
  { host: "dailytips.example/sleep", headline: "Every adult needs at least eight hours of sleep", fine: "[1] health.example: “…most adults need seven or more hours.”", label: "Partial", color: "var(--amber)", cite: "“most adults need seven or more hours of sleep per night”" },
];
const STEPS = ["Validators fetch the post", "…and every cited source", "Each quote is matched word for word", "Consensus on the verdict"];

/** Auto-playing walkthrough: headline -> fine print -> validators -> verdict stamp. */
export function VerdictDemo() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => { if (p >= 8) { setIdx((i) => (i + 1) % EXAMPLES.length); return 0; } return p + 1; }), 1150);
    return () => clearInterval(t);
  }, []);
  const ex = EXAMPLES[idx];
  return (
    <div className="receipt">
      <div className="win">
        <div className="win-bar"><i /><i /><i /><span>https://{ex.host}</span></div>
        <div className="page-mock">
          <span className="eyebrow">the post</span>
          <h3 style={{ marginTop: 10 }}><span className={`sweep ${phase >= 1 ? "on" : ""}`}>{ex.headline}</span><sup>[1]</sup></h3>
          <p style={{ color: "var(--ink2)", margin: 0, maxWidth: "46ch" }}>As reported this week, according to the linked source.</p>
          <div className={`fp ${phase >= 2 ? "hot" : ""}`}>{ex.fine}</div>
        </div>
      </div>
      <div className="win">
        <div className="win-bar"><i /><i /><i /><span>cited source · validator consensus</span></div>
        <div className="vpanel" style={{ ["--c" as string]: ex.color } as CSSProperties}>
          {STEPS.map((s, i) => <div key={s} className={`step-line ${phase >= i + 3 ? "on" : ""}`}><b>{phase >= i + 3 ? "✓" : i + 1}</b>{s}</div>)}
          <div className="quote-block" style={{ opacity: phase >= 5 ? 1 : 0, transition: "opacity .6s" }}>{ex.cite}</div>
          <span className="cap">verdict and framing are labelled separately</span>
          <div className={`stamp ${phase >= 7 ? "show" : ""}`} key={idx + "-" + (phase >= 7)}>{ex.label}</div>
          <div style={{ minHeight: 56 }} />
        </div>
      </div>
    </div>
  );
}

import { ClaimCard } from "./claim-card";
import { demoClaims } from "@/lib/domain";

/** Sample cards built on the client so their countdowns are always fresh. */
export function DemoFeed() {
  const [claims] = useState(() => demoClaims().slice(0, 3));
  return <>{claims.map((c, i) => <ClaimCard key={c.id} claim={c} delay={i * 0.1} />)}</>;
}
