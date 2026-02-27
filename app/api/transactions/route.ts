import { NextResponse } from "next/server";
import { currentMonthKey } from "@/lib/date";
import { requireApiAccess } from "@/lib/guard";
import { serverError, unauthorized } from "@/lib/http";
import { listTransactions } from "@/lib/services/transaction-service";

export async function GET(request: Request) {
  try {
    const userId = await requireApiAccess();
    const { searchParams } = new URL(request.url);

    const month = searchParams.get("month") ?? currentMonthKey();
    const search = searchParams.get("search") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const onlyOutliers = searchParams.get("outliers") === "true";
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "50");

    const result = await listTransactions({
      userId,
      month,
      search,
      categoryId,
      onlyOutliers,
      page,
      pageSize
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    return serverError();
  }
}
