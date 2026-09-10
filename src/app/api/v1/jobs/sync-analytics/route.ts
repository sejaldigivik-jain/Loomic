import { NextResponse } from "next/server";
import { syncInstagramAnalytics } from "@/lib/analytics-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Publishing waits on Meta's media processing, so give the function the most
// wall-clock time the Vercel plan allows (Hobby caps at 60s).
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: { code: "unauthorized", message: "Invalid cron secret" } }, { status: 401 });
  const results = await syncInstagramAnalytics(100);
  return NextResponse.json({ data: { processed: results.length, results }, meta: {} });
}
export const POST = GET;
