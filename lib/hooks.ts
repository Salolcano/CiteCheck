"use client";
import { useEffect, useState } from "react";

/** Current unix time in seconds, or null until mounted (keeps server and client markup identical). */
export function useNowSec(everyMs = 30000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const t = setInterval(tick, everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
