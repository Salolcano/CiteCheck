/** Hand-drawn "tangle in, one verdict out" hero, drawn as SVG with CSS animation. */
export function HeroArt() {
  const rays = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 900 340">
        <path className="scribble" d="M8 190 C 40 40 110 40 92 150 C 74 262 190 292 200 160 C 210 58 118 92 140 190 C 160 284 262 232 252 178 C 246 146 300 140 330 190 L 800 190" />
        <path className="line-flow" d="M330 190 L 800 190" />
        <rect className="shape" style={{ ["--d" as string]: "2.2s" }} x="408" y="168" width="44" height="44" rx="6" />
        <path className="shape" style={{ ["--d" as string]: "2.55s" }} d="M538 190 C 538 166 584 164 584 192 C 584 218 540 220 538 190 Z" />
        <path className="shape" style={{ ["--d" as string]: "2.9s" }} d="M690 164 L716 212 L664 212 Z" />
        <circle className="spark" cx="850" cy="190" r="13" />
        {rays.map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} className="ray" x1={850 + Math.cos(r) * 24} y1={190 + Math.sin(r) * 24} x2={850 + Math.cos(r) * 38} y2={190 + Math.sin(r) * 38} />;
        })}
        {[["claim", 170, "0.9s"], ["sources", 430, "2.4s"], ["validators", 561, "2.75s"], ["consensus", 690, "3.1s"], ["verdict", 850, "3.8s"]].map(([t, x, d]) => (
          <text key={t as string} className="art-label" x={x as number} y={262} textAnchor="middle" style={{ ["--d" as string]: d as string }}>{t}</text>
        ))}
        <text className="float serif" x="120" y="60" fontSize="40" fill="#ff4a3a" style={{ ["--d" as string]: "0s" }}>*</text>
        <text className="float serif" x="470" y="90" fontSize="30" fill="#ff4a3a" style={{ ["--d" as string]: "1.2s" }}>*</text>
        <text className="float serif" x="720" y="110" fontSize="36" fill="#ff4a3a" style={{ ["--d" as string]: "2.1s" }}>*</text>
      </svg>
    </div>
  );
}

const icon = {
  stake: <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" /><path d="M32 18v28M24 26c0-4 16-4 16 2s-16 2-16 8 16 6 16 2" /></svg>,
  judge: <svg viewBox="0 0 64 64"><path d="M10 14h44v30H30l-12 10V44H10z" /><path d="M20 26h24M20 34h14" /></svg>,
  recheck: <svg viewBox="0 0 64 64"><path d="M52 24A22 22 0 1 0 54 36" /><path d="M54 12v14H40" /></svg>,
  appeal: <svg viewBox="0 0 64 64"><path d="M32 8v44M16 52h32M12 20h40" /><path d="M12 20l-6 18h12zM52 20l-6 18h12z" /></svg>,
};
export const STEP_ICONS = icon;

/** Verdict on one axis, framing on the other: the two labels are independent. */
export function AxesGraphic() {
  const pts: [string, number, number, string][] = [
    ["Emissions cut 40%", 80, 80, "#ff4a3a"], ["Walking lowers stress", 300, 270, "#4fc482"], ["8 hours for everyone", 245, 110, "#e3a22f"],
    ["Vitamin D cures…", 150, 55, "#9a958a"], ["5-minute charge", 330, 165, "#4fc482"], ["Wages beat prices", 70, 230, "#ff4a3a"],
  ];
  return (
    <svg viewBox="0 0 520 380" role="img" aria-label="Verdict and framing are independent axes">
      <g stroke="#26262a" strokeWidth="1">{[1, 2, 3].map((i) => <line key={i} x1={i * 130} y1="20" x2={i * 130} y2="330" />)}{[1, 2].map((i) => <line key={i} x1="20" y1={20 + i * 103} x2="500" y2={20 + i * 103} />)}</g>
      <rect x="20" y="20" width="480" height="310" fill="none" stroke="#38383e" rx="14" />
      <text x="260" y="360" textAnchor="middle" className="cap">misrepresents  ←  cited source  →  supports</text>
      <text x="14" y="175" className="cap" transform="rotate(-90 14 175)" textAnchor="middle">fair  ←  framing  →  overstated</text>
      {pts.map(([t, x, y, c], i) => (
        <g key={t} className="pt" style={{ ["--d" as string]: `${i * 0.5}s` }}>
          <circle cx={x} cy={y} r="8" fill={c} /><circle cx={x} cy={y} r="15" fill="none" stroke={c} strokeOpacity=".3" />
          <text x={x + 20} y={y + 4} fontSize="12" fill="#bdb8ac" fontFamily="var(--font-mono)">{t}</text>
        </g>
      ))}
    </svg>
  );
}
