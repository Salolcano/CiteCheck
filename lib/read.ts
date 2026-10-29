import { readClient } from "./chain";
import { ADDR, type Addr } from "./contracts";
import type { Appeal, Bond, Claim, Funding, Reputation } from "./domain";

async function view(address: Addr, functionName: string, args: (string | number | bigint)[] = []): Promise<string> {
  const out = await readClient().readContract({ address, functionName, args });
  return typeof out === "string" ? out : String(out ?? "");
}
const json = <T,>(s: string): T | null => (s ? (JSON.parse(s) as T) : null);

export async function fetchClaims(offset = 0, limit = 25): Promise<Claim[]> {
  return json<Claim[]>(await view(ADDR.main, "list_claims", [offset, limit])) ?? [];
}
export async function fetchClaim(id: string) { return json<Claim>(await view(ADDR.main, "get_claim", [id])); }
export async function fetchBond(id: string) { return json<Bond>(await view(ADDR.main, "get_bond", [id])); }
export async function fetchFunding(id: string) { return json<Funding>(await view(ADDR.main, "get_funding", [id])); }
export async function fetchAppeal(id: string, version: number) { return json<Appeal>(await view(ADDR.main, "get_appeal", [id, version])); }
export async function fetchOpenAppeal(id: string) { return (await view(ADDR.main, "has_open_appeal", [id])).toLowerCase() === "true"; }
export async function fetchCredit(account: string) { return BigInt((await view(ADDR.main, "get_credit", [account])) || "0"); }
export async function fetchReputation(account: string) {
  return json<Reputation>(await view(ADDR.main, "get_reputation", [account])) ?? { released: 0, upheld: 0, overturned: 0 };
}
