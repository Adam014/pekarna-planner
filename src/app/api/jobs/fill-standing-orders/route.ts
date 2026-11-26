/**
 * The daily job (ADR 0007): creates the standing order days that came into
 * the 28-day horizon. Called by Vercel Schedules (vercel.json), safe to run
 * twice or at the same time as the bake plan.
 */
import { cronSecret, isScheduledRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { fillStandingOrderDays } from "@/lib/services/standing-orders.service";

export async function POST(request: Request) {
  const secret = cronSecret(process.env.CRON_SECRET);
  if (!secret) {
    // Otherwise every nightly run would fail without a trace.
    console.error("fill-standing-orders: CRON_SECRET missing or too short");
  }
  if (!isScheduledRequest(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { skipped } = await fillStandingOrderDays(db, Temporal.Now.instant());
  // Only the count is logged; the owner sees the days in the app.
  console.log(`fill-standing-orders: ${skipped.length} days skipped`);
  return Response.json({ skipped: skipped.length });
}
