import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/guard";
import { serverError, unauthorized } from "@/lib/http";
import { listAlerts } from "@/lib/services/alert-service";

export async function GET(request: Request) {
  try {
    const userId = await requireApiAccess();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const items = await listAlerts(userId, status === "open");
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    return serverError();
  }
}
