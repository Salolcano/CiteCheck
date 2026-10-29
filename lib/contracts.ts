import deployment from "../public/deployment.json";

export type Addr = `0x${string}`;
const pick = (env: string | undefined, file: string) => ((env && env.trim()) || file) as Addr;

/** One Intelligent Contract holds claims, rechecks, bonds and appeals. The env var wins over public/deployment.json. */
export const ADDR = {
  main: pick(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, deployment.contract),
};

export const isZero = (a: string) => /^0x0*$/i.test(a);
export const isLive = !!ADDR.main && !isZero(ADDR.main);
export const APPEAL_WINDOW_SECONDS = deployment.appealWindowSeconds;

export const MODULES = [
  { name: "Claims", role: "Immutable, versioned verdicts on company claims" },
  { name: "Recheck", role: "Re-reads sources and appends new versions" },
  { name: "Bonds", role: "Writer bonds, appeal deposits and pull payouts" },
  { name: "Appeals", role: "One contest per version, ruled by validators" },
] as const;
