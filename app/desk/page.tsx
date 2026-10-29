import type { Metadata } from "next";
import Desk from "@/components/desk";
import { TxProvider } from "@/lib/tx";
import { WalletProvider } from "@/lib/wallet";

export const metadata: Metadata = { title: "The desk · Cite Check" };

export default function DeskPage() {
  return (
    <WalletProvider>
      <TxProvider>
        <Desk />
      </TxProvider>
    </WalletProvider>
  );
}
