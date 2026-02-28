import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAccess } from "@/lib/guard";
import { badRequest, serverError, unauthorized } from "@/lib/http";
import { createConnectionWithCredentials, listConnections } from "@/lib/services/connection-service";
import { ensureDefaultCategories } from "@/lib/services/category-service";

const CreateBodySchema = z.object({
  provider: z.string().min(1),
  displayName: z.string().min(1),
  institution: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  accountNumber: z.string().trim().optional(),
  card6Digits: z.string().trim().optional()
});

export async function GET() {
  try {
    const userId = await requireApiAccess();
    const connections = await listConnections(userId);
    return NextResponse.json({ items: connections });
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireApiAccess();
    await ensureDefaultCategories(userId);
    const body = CreateBodySchema.parse(await request.json());
    const institutionKey = body.institution.trim().toLowerCase();
    const isDiscount = ["discount", "discount bank", "דיסקונט"].includes(institutionKey);
    const isIsracard = ["isracard", "isracart", "isra card", "ישראכרט"].includes(institutionKey);
    if (isDiscount && !body.accountNumber) {
      return badRequest("Discount requires accountNumber.");
    }
    if (isIsracard && !/^\d{6}$/.test(body.card6Digits ?? "")) {
      return badRequest("Isracard requires card6Digits (6 digits).");
    }

    const connection = await createConnectionWithCredentials({
      userId,
      provider: body.provider,
      displayName: body.displayName,
      credentials: {
        institution: body.institution,
        username: body.username,
        password: body.password,
        accountNumber: body.accountNumber || undefined,
        card6Digits: body.card6Digits || undefined
      }
    });

    return NextResponse.json({
      id: connection.id,
      provider: connection.provider,
      displayName: connection.displayName,
      status: connection.status
    });
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    if (error instanceof z.ZodError) {
      return badRequest(error.message);
    }
    return serverError();
  }
}
