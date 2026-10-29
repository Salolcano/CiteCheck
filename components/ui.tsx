"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { VERDICT_META, FRAMING_META, type Verdict, type Framing } from "@/lib/domain";

/** Fades content in once it scrolls into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${on ? "in" : ""} ${className}`} style={{ "--d": `${delay}s` } as CSSProperties}>{children}</div>;
}

/** Counts up to `value` when first shown. */
export function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toFixed(decimals)}</>;
}

export function VerdictChip({ label }: { label: Verdict }) {
  return <span className="vchip" style={{ "--c": VERDICT_META[label].color } as CSSProperties}>{VERDICT_META[label].name}</span>;
}
export function FramingChip({ label }: { label: Framing }) {
  return <span className="vchip hype">{FRAMING_META[label].name}</span>;
}
