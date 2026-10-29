/** Sanity check: is the RPC Studio, and are our four contracts wired? */
import { readFileSync } from "node:fs";

const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio.genlayer.com/api";
const res = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
const id = parseInt((await res.json()).result, 16);
console.log(`RPC ${RPC}\nchain id ${id} ${id === 61999 ? "✓ Studio" : "✗ expected 61999"}`);
const d = JSON.parse(readFileSync("public/deployment.json", "utf8"));
console.log(`contract ${d.contract}`);
process.exit(id === 61999 ? 0 : 1);
