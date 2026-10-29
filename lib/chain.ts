import { createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";

/** GenLayer Studio network (chain 61999). */
export const CHAIN_ID = 61999;
export const NETWORK_NAME = "Studio";
export const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio.genlayer.com/api";
export const EXPLORER = (process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-studio.genlayer.com").replace(/\/$/, "");

/** Use the SDK's Studio chain definition (consensus contract addresses etc.), pinned to our id and RPC. */
const base = ((chains as Record<string, unknown>).studionet ?? (chains as Record<string, unknown>).studioDevnet) as Record<string, unknown>;
export const chain = {
  ...base,
  id: CHAIN_ID,
  name: "GenLayer Studio",
  rpcUrls: { default: { http: [RPC] } },
} as never;

export const explorerTx = (hash: string) => `${EXPLORER}/transactions/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER}/address/${address}`;

export const walletChain = {
  chainId: "0x" + CHAIN_ID.toString(16),
  chainName: "GenLayer Studio",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: [RPC],
  blockExplorerUrls: [EXPLORER],
};

export const readClient = () => createClient({ chain, endpoint: RPC } as never);
