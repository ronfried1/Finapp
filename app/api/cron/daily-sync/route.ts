import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runDailySyncAllUsers } from "@/lib/services/sync-service";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== env.CRON_SHARED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailySyncAllUsers();
  return NextResponse.json({ ok: true, ...result });
}
