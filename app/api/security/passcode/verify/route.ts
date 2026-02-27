import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { setPasscodeVerifiedCookie, verifyPasscode } from "@/lib/passcode";

const BodySchema = z.object({
  passcode: z.string().regex(/^\d{4,8}$/)
});

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = BodySchema.parse(await request.json());
    const record = await prisma.appPasscode.findUnique({ where: { userId } });

    if (!record?.enabled) {
      return NextResponse.json({ error: "Passcode not enabled" }, { status: 400 });
    }

    const isValid = await verifyPasscode(body.passcode, record.hash);
    if (!isValid) {
      await prisma.appPasscode.update({
        where: { userId },
        data: { failedCount: { increment: 1 } }
      });
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    await prisma.appPasscode.update({
      where: { userId },
      data: { failedCount: 0, lockedUntil: null }
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
