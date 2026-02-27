import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMonthKey } from "@/lib/date";
import { requireApiAccess } from "@/lib/guard";
import { badRequest, serverError, unauthorized } from "@/lib/http";
import { setMonthlyBudget } from "@/lib/services/budget-service";

const BodySchema = z.object({
  capAmount: z.number().positive()
});

export async function PUT(request: Request) {
  try {
    const userId = await requireApiAccess();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonthKey();
    const body = BodySchema.parse(await request.json());

    const result = await setMonthlyBudget(userId, month, body.capAmount);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    if (error instanceof z.ZodError) {
      return badRequest("Invalid budget payload");
    }
    return serverError();
  }
}
