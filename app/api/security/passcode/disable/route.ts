import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { clearPasscodeVerifiedCookie } from "@/lib/passcode";

export async function POST() {
  try {
    const userId = await requireUserId();
    await prisma.appPasscode.upsert({
      where: { userId },
      create: { userId, hash: "disabled", enabled: false },
      update: { enabled: false, failedCount: 0, lockedUntil: null }
    });

    await clearPasscodeVerifiedCookie();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
