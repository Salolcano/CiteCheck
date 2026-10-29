"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CHAIN_ID, walletChain } from "./chain";

export interface Eip1193 {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}
declare global { interface Window { ethereum?: Eip1193 } }

interface WalletState {
  account: string | null; provider: Eip1193 | null; connecting: boolean; error: string | null; onChain: boolean;
  connect: () => Promise<string | null>; disconnect: () => void;
}
const Ctx = createContext<WalletState | null>(null);
const HEX_ID = walletChain.chainId;
let inflight: Promise<string | null> | null = null; // one wallet permission prompt at a time

async function ensureChain(p: Eip1193) {
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX_ID }] });
  } catch (e) {
    const err = e as { code?: number; message?: string };
    if (err.code === 4902 || /unrecognized chain|not been added/i.test(err.message ?? "")) {
      await p.request({ method: "wallet_addEthereumChain", params: [walletChain] });
    } else throw e;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<Eip1193 | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    const p = window.ethereum;
    if (!p) return;
    setProvider(p);
    p.request({ method: "eth_accounts" }).then((a) => setAccount((a as string[])[0]?.toLowerCase() ?? null)).catch(() => {});
    p.request({ method: "eth_chainId" }).then((c) => setChainId(parseInt(String(c), 16))).catch(() => {});
    const onAccounts = (a: unknown) => setAccount((a as string[])[0]?.toLowerCase() ?? null);
    const onChain = (c: unknown) => setChainId(parseInt(String(c), 16));
    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => { p.removeListener?.("accountsChanged", onAccounts); p.removeListener?.("chainChanged", onChain); };
  }, []);

  const connect = useCallback(async () => {
    const p = window.ethereum;
    if (!p) { setError("No browser wallet found. Install MetaMask or another EIP-1193 wallet."); return null; }
    if (inflight) return inflight;
    setConnecting(true); setError(null);
    inflight = (async () => {
      try {
        const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
        await ensureChain(p);
        setProvider(p); setChainId(CHAIN_ID);
        const a = accounts[0]?.toLowerCase() ?? null;
        setAccount(a);
        return a;
      } catch (e) {
        const err = e as { code?: number; message?: string };
        setError(err.code === 4001 ? "Request cancelled in the wallet." : err.message ?? "Wallet connection failed.");
        return null;
      } finally { inflight = null; setConnecting(false); }
    })();
    return inflight;
  }, []);

  const disconnect = useCallback(() => setAccount(null), []);
  const value = useMemo<WalletState>(() => ({ account, provider, connecting, error, onChain: chainId === CHAIN_ID, connect, disconnect }),
    [account, provider, connecting, error, chainId, connect, disconnect]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside WalletProvider");
  return v;
}
