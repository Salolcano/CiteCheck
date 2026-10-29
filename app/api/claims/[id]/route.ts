import { NextResponse } from "next/server";
import { isLive } from "@/lib/contracts";
import { fetchAppeal, fetchBond, fetchClaim, fetchFunding, fetchOpenAppeal } from "@/lib/read";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isLive) return NextResponse.json({ live: false });
  try {
    const claim = await fetchClaim(id);
    if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 });
    const [bond, funding, appeal, openAppeal] = await Promise.all([
      fetchBond(id), fetchFunding(id), fetchAppeal(id, claim.version), fetchOpenAppeal(id),
    ]);
    return NextResponse.json({ live: true, claim, bond, funding, appeal, openAppeal });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "read failed" }, { status: 502 });
  }
}
