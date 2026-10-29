"use client";
import { current, hostOf, fmtGen, timeLeft, type Claim } from "@/lib/domain";
import { useNowSec } from "@/lib/hooks";
import { VerdictChip, FramingChip } from "./ui";

/** Renders the claim text with its first words highlighted, like a marker pen. */
function Marked({ text }: { text: string }) {
  const parts = text.split(" ");
  const k = Math.min(4, Math.max(2, Math.ceil(parts.length / 3)));
  return <><mark>{parts.slice(0, k).join(" ")}</mark> {parts.slice(k).join(" ")}</>;
}

export function ClaimCard({ claim, onOpen, delay = 0 }: { claim: Claim; onOpen?: (id: string) => void; delay?: number }) {
  const d = current(claim);
  const now = useNowSec();
  return (
    <button className="card claim" onClick={() => onOpen?.(claim.id)} style={{ ["--d" as string]: `${delay}s` }}>
      <div className="claim-top">
        <span className="host">{hostOf(claim.claim_url)}</span>
        <VerdictChip label={d.verdict} />
        <FramingChip label={d.framing} />
      </div>
      <p className="claim-quote">“<Marked text={claim.claim_quote} />”</p>
      <div className="claim-meta">
        <span>v{claim.version}</span>
        <span>{fmtGen(claim.bond_amount)} GEN bonded</span>
        <span>{d.citations.length} citation{d.citations.length === 1 ? "" : "s"}</span>
        <span>{claim.open ? (now ? timeLeft(claim.deadline, now) : "…") : "settled"}</span>
        {!d.quote_found && <span style={{ color: "var(--red)" }}>statement removed from the post</span>}
      </div>
    </button>
  );
}
