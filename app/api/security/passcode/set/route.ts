import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPasscode, setPasscodeVerifiedCookie } from "@/lib/passcode";
import { requireUserId } from "@/lib/auth";

const BodySchema = z.object({
  passcode: z.string().regex(/^\d{4,8}$/)
});

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = BodySchema.parse(await request.json());
    const hash = await hashPasscode(body.passcode);

    await prisma.appPasscode.upsert({
      where: { userId },
      create: { userId, hash, enabled: true },
      update: { hash, enabled: true, failedCount: 0, lockedUntil: null }
    });

    await setPasscodeVerifiedCookie(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
