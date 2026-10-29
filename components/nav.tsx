"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { NETWORK_NAME, CHAIN_ID } from "@/lib/chain";
import { shortAddr } from "@/lib/domain";
import { useWallet } from "@/lib/wallet";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Cite Check home">
      <span className="mark">“</span>Cite Check
    </Link>
  );
}

export function SiteNav({ right, desk = false }: { right?: ReactNode; desk?: boolean }) {
  return (
    <header className="nav">
      <div className="nav-in">
        <Logo />
        <nav className="nav-links">
          <Link href={desk ? "/" : "#how"}>How it works</Link>
          <Link href={desk ? "/#labels" : "#labels"}>Labels</Link>
          <Link href={desk ? "/#contracts" : "#contracts"}>Contracts</Link>
          <Link href="/desk">The desk</Link>
        </nav>
        <div className="nav-right">
          <span className="net"><i />{NETWORK_NAME} · {CHAIN_ID}</span>
          {right ?? <Link href="/desk" className="btn primary sm">Open the desk →</Link>}
        </div>
      </div>
    </header>
  );
}

export function ConnectButton() {
  const { account, connect, connecting, onChain, disconnect } = useWallet();
  if (!account) return <button className="btn primary sm" onClick={connect} disabled={connecting}>{connecting ? "Connecting…" : "Connect wallet"}</button>;
  return (
    <button className="btn sm" onClick={onChain ? disconnect : connect} title={onChain ? "Click to hide address" : "Switch to Studio"}>
      {onChain ? shortAddr(account) : "Switch network"}
    </button>
  );
}
