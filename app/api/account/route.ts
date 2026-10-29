import { NextResponse } from "next/server";
import { isLive } from "@/lib/contracts";
import { fetchCredit, fetchReputation } from "@/lib/read";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "bad address" }, { status: 400 });
  if (!isLive) return NextResponse.json({ live: false, credit: "0", reputation: { released: 0, upheld: 0, overturned: 0 } });
  try {
    const [credit, reputation] = await Promise.all([fetchCredit(address), fetchReputation(address)]);
    return NextResponse.json({ live: true, credit: credit.toString(), reputation });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "read failed" }, { status: 502 });
  }
}
