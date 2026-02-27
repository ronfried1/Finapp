import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAccess } from "@/lib/guard";
import { badRequest, serverError, unauthorized } from "@/lib/http";
import { submitSyncChallenge } from "@/lib/services/sync-service";

const BodySchema = z.object({ otpCode: z.string().min(4).max(10) });

export async function POST(request: Request, context: { params: Promise<{ challengeId: string }> }) {
  try {
    const userId = await requireApiAccess();
    const body = BodySchema.parse(await request.json());
    const { challengeId } = await context.params;
    const result = await submitSyncChallenge(userId, challengeId, body.otpCode);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    if (error instanceof z.ZodError) {
      return badRequest("Invalid OTP payload");
    }
    return serverError(error instanceof Error ? error.message : "Challenge error");
  }
}
