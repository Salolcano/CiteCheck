/**
 * Optional CLI deploy of the single Cite Check contract to GenLayer Studio (chain 61999).
 *   DEPLOYER_PRIVATE_KEY=0x... npm run deploy:contracts
 * (You can also paste contracts/citecheck.py into Studio and deploy there; no script needed.)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const FILE = "public/deployment.json";
const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio.genlayer.com/api";
const WINDOW = Number(process.env.APPEAL_WINDOW_SECONDS || 900);
const key = process.env.DEPLOYER_PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY=0x<64 hex chars> (a Studio test account).");

/* eslint-disable @typescript-eslint/no-explicit-any */
const client: any = createClient({ chain: ((chains as any).studionet ?? (chains as any).studioDevnet), endpoint: RPC, account: createAccount(key as `0x${string}`) });
const state = JSON.parse(readFileSync(FILE, "utf8"));

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result as Record<string, any> | null;
}

async function main() {
  const chainId = parseInt(String((await rpc("eth_chainId", [])) ?? "0"), 16);
  if (chainId !== 61999) throw new Error(`Expected Studio (61999) but the RPC reports ${chainId}.`);
  let fees: Record<string, unknown> = {};
  try { const est = await client.estimateTransactionFees({}); fees = { fees: est?.fees ?? est }; } catch { /* gasless or unavailable */ }
  console.log("Deploying CiteCheck…");
  const hash = await client.deployContract({ code: readFileSync("contracts/citecheck.py", "utf8"), args: [WINDOW], ...fees });
  await client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, retries: 90, interval: 5000 });
  const raw = await rpc("eth_getTransactionByHash", [hash]);
  const address = String(raw?.to_address ?? raw?.recipient ?? raw?.data?.contract_address ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error(`Could not read the address from ${hash}. Find it in the explorer.`);
  state.contract = address; state.appealWindowSeconds = WINDOW; state.transactions = { deploy: hash }; state.deployedAt = new Date().toISOString();
  writeFileSync(FILE, JSON.stringify(state, null, 2) + "\n");
  console.log("Deployed:", address, "\nCommit public/deployment.json or set NEXT_PUBLIC_CONTRACT_ADDRESS in Vercel.");
}
main().catch((e) => { console.error("Deploy failed:", e instanceof Error ? e.message : e); process.exit(1); });
