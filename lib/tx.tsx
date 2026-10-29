"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { chain, explorerTx, RPC } from "./chain";
import { useWallet } from "./wallet";
import type { Addr } from "./contracts";

export interface TxSpec { address: Addr; method: string; args: (string | number | bigint | boolean)[]; value?: bigint }
type Phase = "signing" | "consensus" | "done" | "failed";
interface Toast { id: number; label: string; phase: Phase; detail: string; hash?: string }

/** The slice of genlayer-js used for every write (wallet-signed, fees quoted when the network supports it). */
interface Direct {
  estimateTransactionFees(o: object): Promise<{ fees?: unknown } & Record<string, unknown>>;
  writeContract(o: Record<string, unknown>): Promise<string>;
  waitForTransactionReceipt(o: Record<string, unknown>): Promise<unknown>;
}
interface TxApi { send: (label: string, spec: TxSpec) => Promise<boolean> }
const Ctx = createContext<TxApi | null>(null);

const COPY: Record<Phase, string> = {
  signing: "Confirm in your wallet", consensus: "Validators are reaching consensus…", done: "Accepted by validators", failed: "Did not complete",
};

export function TxProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const patch = (id: number, p: Partial<Toast>) => setToasts((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const send = useCallback(async (label: string, spec: TxSpec): Promise<boolean> => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, label, phase: "signing", detail: COPY.signing }]);
    try {
      const account = wallet.account ?? (await wallet.connect());
      if (!account || !window.ethereum) throw new Error("Connect a wallet first.");
      const client = createClient({ chain, endpoint: RPC, account: account as `0x${string}` } as never) as unknown as Direct;
      const est = await client.estimateTransactionFees({}).catch(() => null);
      const hash = await client.writeContract({
        address: spec.address, functionName: spec.method, args: spec.args, value: spec.value ?? 0n,
        ...(est ? { fees: est.fees ?? est } : {}),
      });
      patch(id, { phase: "consensus", detail: COPY.consensus, hash });
      const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 120, interval: 4000 });
      const text = JSON.stringify(receipt, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
      if (/FINISHED_WITH_ERROR|UNDETERMINED|LEADER_TIMEOUT|VALIDATORS_TIMEOUT|CANCELED/.test(text)) throw new Error("The contract rejected this call. Check the inputs and try again.");
      patch(id, { phase: "done", detail: COPY.done });
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 9000);
      return true;
    } catch (e) {
      const err = e as { code?: number; message?: string };
      patch(id, { phase: "failed", detail: err.code === 4001 ? "Cancelled in the wallet." : (err.message ?? "Transaction failed").slice(0, 160) });
      return false;
    }
  }, [wallet]);

  const api = useMemo(() => ({ send }), [send]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.phase}`}>
            <span className="toast-dot" />
            <div>
              <b>{t.label}</b>
              <small>{t.detail}</small>
              {t.hash && <a href={explorerTx(t.hash)} target="_blank" rel="noreferrer">View on explorer ↗</a>}
            </div>
            <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useTx(): TxApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTx must be used inside TxProvider");
  return v;
}
