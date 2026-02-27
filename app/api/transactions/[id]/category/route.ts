import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAccess } from "@/lib/guard";
import { badRequest, serverError, unauthorized } from "@/lib/http";
import { recategorizeTransaction } from "@/lib/services/transaction-service";

const BodySchema = z.object({
  categoryId: z.string().min(1),
  createRule: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireApiAccess();
    const { id } = await context.params;
    const body = BodySchema.parse(await request.json());

    const result = await recategorizeTransaction({
      userId,
      transactionId: id,
      categoryId: body.categoryId,
      createRule: body.createRule
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    if (error instanceof z.ZodError) {
      return badRequest("Invalid payload");
    }
    return serverError(error instanceof Error ? error.message : "Recategorization failed");
  }
}
