import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/guard";
import { serverError, unauthorized } from "@/lib/http";
import { startConnectionSync } from "@/lib/services/sync-service";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireApiAccess();
    const { id } = await context.params;
    const result = await startConnectionSync(userId, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    return serverError(error instanceof Error ? error.message : "Sync error");
  }
}
