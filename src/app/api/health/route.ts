import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.user.count();
    return Response.json({ ok: true, service: "socialflow", database: "ready", time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, service: "socialflow", database: "unavailable", time: new Date().toISOString() }, { status: 503 });
  }
}
