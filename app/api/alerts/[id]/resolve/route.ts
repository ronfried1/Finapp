import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/guard";
import { serverError, unauthorized } from "@/lib/http";
import { resolveAlert } from "@/lib/services/alert-service";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireApiAccess();
    const { id } = await context.params;
    await resolveAlert(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    return serverError();
  }
}
