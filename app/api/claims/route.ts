import { NextResponse } from "next/server";
import { demoClaims } from "@/lib/domain";
import { isLive } from "@/lib/contracts";
import { fetchClaims } from "@/lib/read";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isLive) return NextResponse.json({ live: false, claims: demoClaims() });
  try {
    return NextResponse.json({ live: true, claims: await fetchClaims(0, 25) });
  } catch (e) {
    return NextResponse.json({ live: true, claims: [], error: e instanceof Error ? e.message : "Studio read failed" }, { status: 502 });
  }
}
