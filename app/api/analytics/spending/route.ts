import { NextResponse } from "next/server";
import { currentMonthKey } from "@/lib/date";
import { requireApiAccess } from "@/lib/guard";
import { serverError, unauthorized } from "@/lib/http";
import { getSpendingAnalytics } from "@/lib/services/analytics-service";

export async function GET(request: Request) {
  try {
    const userId = await requireApiAccess();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonthKey();
    const analytics = await getSpendingAnalytics(userId, month);
    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    return serverError();
  }
}
