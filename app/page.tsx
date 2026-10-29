import Link from "next/link";
import { HeroArt, AxesGraphic, STEP_ICONS } from "@/components/art";
import { DemoFeed, VerdictDemo } from "@/components/landing-client";
import { SiteNav } from "@/components/nav";
import { VerdictChip, Reveal } from "@/components/ui";
import { CHAIN_ID, explorerAddress } from "@/lib/chain";
import { ADDR, MODULES, isZero } from "@/lib/contracts";
import { VERDICT_META, type Verdict } from "@/lib/domain";

const TICKS: [string, Verdict][] = [
  ["City cut emissions 40% since 2015", "MISREPRESENTS"], ["Daily walking lowers stress", "SUPPORTS"], ["Every adult needs eight hours of sleep", "PARTIAL"],
  ["Vitamin D cures seasonal depression", "NOT_FOUND"], ["Battery charges in five minutes", "SUPPORTS"], ["Wages beat prices last year", "MISREPRESENTS"],
  ["Study proves coffee cures insomnia", "NOT_FOUND"], ["Report: crime halved in a decade", "PARTIAL"],
];

export default function Landing() {
  const loop = [...TICKS, ...TICKS];
  return (
    <>
      <SiteNav />
      <main>
        <section className="hero wrap">
          <span className="pill"><b>live</b> GenLayer · Studio · chain {CHAIN_ID}</span>
          <h1 className="display" style={{ marginTop: 26 }}>Check the <em>citation.</em><br />Get paid when you’re right.</h1>
          <p className="lede">Cite Check reads the link a post cites and judges whether that source really says what the post claims. GenLayer validators independently fetch both pages, writers stake GEN on their notes, and anyone can appeal.</p>
          <div className="cta-row">
            <Link href="/desk" className="btn primary">Open the desk →</Link>
            <a href="#how" className="btn">How it works</a>
          </div>
          <div className="trust"><span>validator consensus</span><span>immutable history</span><span>bonded notes</span><span>open appeals</span></div>
          <HeroArt />
        </section>

        <div className="marquee" aria-label="Examples of claims and verdicts">
          <div className="marquee-track">
            {loop.map(([t, l], i) => <span key={i} className="tick"><span>“{t}”</span><VerdictChip label={l} /></span>)}
          </div>
        </div>

        <section className="section wrap" id="receipt">
          <Reveal className="center">
            <span className="eyebrow">the citation</span>
            <h2 className="display" style={{ marginTop: 14 }}>The post says one thing.<br /><em>The source says another.</em></h2>
            <p className="lede" style={{ marginTop: 20 }}>Every verdict quotes the cited source word for word. If a validator cannot find the quote in its own copy of the page, it does not count.</p>
          </Reveal>
          <Reveal delay={0.1}><VerdictDemo /></Reveal>
        </section>

        <section className="section wrap" id="how" style={{ paddingTop: 30 }}>
          <Reveal className="center">
            <span className="eyebrow">how it works</span>
            <h2 className="display" style={{ marginTop: 14 }}>Stake. Judge. <em>Recheck. Appeal.</em></h2>
          </Reveal>
          <div className="steps">
            {([
              ["01 · stake", "Back your note", "Lock 1 to 20 GEN against the statement you are checking. Bad notes cost you.", "stake", "Bonds"],
              ["02 · judge", "Validators read", "Independent nodes fetch the post and its cited sources and agree on a verdict.", "judge", "Claims"],
              ["03 · recheck", "New source, new version", "Anyone can add sources. History is appended, never rewritten.", "recheck", "Recheck"],
              ["04 · appeal", "Contest it", "Fund a deposit, submit better sources, win the writer’s bond.", "appeal", "Appeals"],
            ] as const).map(([n, h, p, ic, tag], i) => (
              <Reveal key={n} delay={i * 0.08}>
                <div className="card step"><span className="tag">{tag}</span><span className="num">{n}</span><h3>{h}</h3><p>{p}</p>{STEP_ICONS[ic]}</div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section wrap" id="labels" style={{ paddingTop: 30 }}>
          <Reveal className="center">
            <span className="eyebrow">two labels, never mixed</span>
            <h2 className="display" style={{ marginTop: 14 }}>Is it <em>supported,</em> and is it <em>overstated?</em></h2>
          </Reveal>
          <div className="axes">
            <Reveal><AxesGraphic /></Reveal>
            <Reveal delay={0.1}>
              <div className="points">
                {(Object.keys(VERDICT_META) as Verdict[]).map((k, i) => (
                  <div key={k}><b>0{i + 1}</b><p><VerdictChip label={k} /> <span style={{ marginLeft: 8 }}>{VERDICT_META[k].blurb}</span></p></div>
                ))}
                <div><b>→</b><p>Framing is a separate label: <b style={{ color: "var(--ink)" }}>Fair</b>, <b style={{ color: "var(--ink)" }}>Overstated</b> or <b style={{ color: "var(--ink)" }}>Unclear</b>. A statement can be supported and still overstated.</p></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section wrap" style={{ paddingTop: 30 }}>
          <Reveal className="center">
            <span className="eyebrow">the desk</span>
            <h2 className="display" style={{ marginTop: 14 }}>A live feed of <em>verdicts.</em></h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="win" style={{ marginTop: 50 }}>
              <div className="win-bar"><i /><i /><i /><span>citecheck · the desk</span></div>
              <div style={{ padding: 22, display: "grid", gap: 14, background: "var(--bg)" }}>
                <DemoFeed />
                <Link href="/desk" className="btn primary" style={{ justifySelf: "center" }}>See the full desk →</Link>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="section wrap" id="contracts" style={{ paddingTop: 30 }}>
          <Reveal className="center">
            <span className="eyebrow">one intelligent contract, four modules</span>
            <h2 className="display" style={{ marginTop: 14 }}>GenLayer is the <em>whole workflow.</em></h2>
            <p className="lede" style={{ marginTop: 20 }}>Verdicts, rechecks, escrow and appeals all run inside one on-chain contract. The website only reads state and forwards wallet-signed transactions.</p>
          </Reveal>
          <div className="contracts">
            {MODULES.map((c, i) => (
              <Reveal key={c.name} delay={i * 0.07}>
                <div className="card contract"><h4>{c.name}</h4><p>{c.role}</p></div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div style={{ textAlign: "center", marginTop: 26 }}>
              {isZero(ADDR.main) ? <span className="addr">contract not deployed yet</span> : <a className="addr" href={explorerAddress(ADDR.main)} target="_blank" rel="noreferrer">{ADDR.main} ↗</a>}
            </div>
          </Reveal>
        </section>

        <section className="wrap">
          <Reveal>
            <div className="cta">
              <span className="orb" />
              <h2 className="display">Open the <em>source.</em></h2>
              <p className="lede">Pick a statement. Open the link it cites. Stake on what it says.</p>
              <Link href="/desk" className="btn red">Open the desk →</Link>
            </div>
          </Reveal>
        </section>
      </main>
      <footer className="footer"><div className="wrap"><span>© 2026 Cite Check · built on GenLayer · Studio</span><span>Labels describe the supplied sources. They do not establish objective truth.</span></div></footer>
    </>
  );
}
