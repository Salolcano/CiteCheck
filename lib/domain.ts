export type Verdict = "SUPPORTS" | "MISREPRESENTS" | "NOT_FOUND" | "PARTIAL";
export type Framing = "OVERSTATED" | "FAIR" | "UNCLEAR";
export interface Citation { url: string; quote: string }
export interface Decision {
  verdict: Verdict; framing: Framing; about_person: "yes" | "no";
  citations: Citation[]; digests: Record<string, string>; quote_found: boolean;
}
export interface Version { version: number; decision: Decision; reason: "CREATED" | "RECHECK" | "APPEAL"; sources: string[]; at: number }
export interface Claim {
  id: string; writer: string; claim_url: string; claim_quote: string; claim_fp: string; sources: string[];
  created_at: number; deadline: number; bond_amount: string; version: number; open: boolean; history: Version[];
}
export interface Bond { id: string; writer: string; amount: string; created_at: number; deadline: number; status: "locked" | "released" | "slashed" | "cancelled" }
export interface Funding { claim_id: string; funder: string; amount: string; status: "available" | "held" | "spent" | "forfeited" | "refunded" }
export interface Appeal { key: string; claim_id: string; version: number; appellant: string; counter_sources: string[]; status: string; ruling: string; created_at: number; label?: string }
export interface Reputation { released: number; upheld: number; overturned: number }

export const GEN = 10n ** 18n;

export const VERDICT_META: Record<Verdict, { name: string; color: string; blurb: string }> = {
  SUPPORTS: { name: "Supports", color: "var(--green)", blurb: "A cited source says what the statement says." },
  PARTIAL: { name: "Partial", color: "var(--amber)", blurb: "A cited source backs only part of it, or with caveats." },
  MISREPRESENTS: { name: "Misrepresents", color: "var(--red)", blurb: "A cited source says something different, or the opposite." },
  NOT_FOUND: { name: "Not found", color: "var(--gray)", blurb: "The sources don't contain it, or could not be read." },
};
export const FRAMING_META: Record<Framing, { name: string }> = {
  FAIR: { name: "Fair" }, OVERSTATED: { name: "Overstated" }, UNCLEAR: { name: "Unclear" },
};
export const VERDICT_ORDER: Verdict[] = ["SUPPORTS", "PARTIAL", "MISREPRESENTS", "NOT_FOUND"];

export const current = (c: Claim): Decision => c.history[c.history.length - 1].decision;

export function fmtGen(wei: string | bigint | undefined, digits = 2): string {
  if (wei === undefined) return "0";
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const whole = v / GEN;
  const frac = ((v % GEN) * 10n ** BigInt(digits)) / GEN;
  return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(digits, "0").replace(/0+$/, "")}`;
}
export const toWei = (gen: number): bigint => BigInt(Math.round(gen * 1e6)) * (GEN / 1_000_000n);
export const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "");
export const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export function timeLeft(deadline: number, nowSec = Math.floor(Date.now() / 1000)): string {
  const s = deadline - nowSec;
  if (s <= 0) return "window closed";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}
export function timeAgo(at: number, nowSec = Math.floor(Date.now() / 1000)): string {
  const s = Math.max(0, nowSec - at);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Mirrors the contract's public_url rule so the UI rejects bad input before a paid transaction. */
export function validPublicUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && h.includes(".") && !u.username && !u.password && (u.port === "" || u.port === "443")
      && u.hash === "" && /^[a-z0-9.-]+$/.test(h) && !/^[0-9.]+$/.test(h) && !/\.(local|internal|localhost|lan|home|corp)$/.test(h) && raw.length <= 2048;
  } catch { return false; }
}
export function parseUrls(text: string): string[] {
  return Array.from(new Set(text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)));
}
export function makeClaimId(url: string, quote: string): string {
  const host = hostOf(url).split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "claim";
  const words = quote.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 3).join("-").slice(0, 20);
  const salt = Math.random().toString(36).slice(2, 7);
  return [host, words, salt].filter(Boolean).join("-").replace(/-+/g, "-").slice(0, 48);
}

export function summarize(claims: Claim[]) {
  const counts: Record<Verdict, number> = { SUPPORTS: 0, MISREPRESENTS: 0, PARTIAL: 0, NOT_FOUND: 0 };
  let staked = 0n, overstated = 0, versions = 0, open = 0;
  for (const c of claims) {
    const d = current(c);
    counts[d.verdict]++;
    if (d.framing === "OVERSTATED") overstated++;
    if (c.open) { staked += BigInt(c.bond_amount || "0"); open++; }
    versions += c.history.length;
  }
  return { total: claims.length, counts, staked, overstated, versions, open };
}

/** Illustrative sample data (fictional sources), shown only until the contract is deployed. */
export function demoClaims(): Claim[] {
  const now = Math.floor(Date.now() / 1000);
  const mk = (id: string, url: string, quote: string, label: Verdict, framing: Framing, cites: Citation[], hoursAgo: number, bond: number): Claim => ({
    id, writer: "0x7a3f00000000000000000000000000000000c91e", claim_url: url, claim_quote: quote, claim_fp: "demo",
    sources: Array.from(new Set(cites.map((c) => c.url))), created_at: now - hoursAgo * 3600, deadline: now - hoursAgo * 3600 + 72 * 3600,
    bond_amount: (BigInt(bond) * GEN).toString(), version: 1, open: true,
    history: [{ version: 1, reason: "CREATED", sources: cites.map((c) => c.url), at: now - hoursAgo * 3600,
      decision: { verdict: label, framing, about_person: "no", citations: cites, digests: {}, quote_found: true } }],
  });
  return [
    mk("demo-city-emissions", "https://newsdesk.example/city-climate", "The city cut emissions by 40% since 2015", "MISREPRESENTS", "OVERSTATED",
      [{ url: "https://data.city.example/emissions-report", quote: "emissions fell 14% between 2015 and 2023" }], 3, 4),
    mk("demo-walking-stress", "https://wellblog.example/walk", "A new study shows daily walking lowers stress", "SUPPORTS", "FAIR",
      [{ url: "https://journal.example/walking-stress", quote: "participants who walked daily reported lower stress scores" }], 9, 2),
    mk("demo-sleep", "https://dailytips.example/sleep", "Every adult needs at least eight hours of sleep", "PARTIAL", "OVERSTATED",
      [{ url: "https://health.example/sleep-guidelines", quote: "most adults need seven or more hours of sleep per night" }], 14, 3),
    mk("demo-vitamin", "https://fitfeed.example/vitamin-d", "Vitamin D cures seasonal depression", "NOT_FOUND", "OVERSTATED", [], 22, 2),
    mk("demo-battery", "https://techwire.example/battery", "The new battery charges in five minutes", "SUPPORTS", "FAIR",
      [{ url: "https://lab.example/battery-test", quote: "charged from 10% to 80% in five minutes" }], 30, 5),
    mk("demo-wages", "https://econnotes.example/wages", "Wages rose faster than prices last year", "MISREPRESENTS", "UNCLEAR",
      [{ url: "https://stats.example/wages-prices", quote: "prices rose 4.1% while wages rose 3.2%" }], 41, 2),
  ];
}
