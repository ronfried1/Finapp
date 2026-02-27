import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { requireApiAccess } from "@/lib/guard";
import { serverError, unauthorized } from "@/lib/http";

export async function GET() {
  try {
    const userId = await requireApiAccess();

    const [
      categories,
      merchantRules,
      connections,
      credentials,
      accounts,
      transactions,
      fixedExpenseProfiles,
      monthlyBudgets,
      alertEvents
    ] = await Promise.all([
      prisma.category.findMany({ where: { userId } }),
      prisma.merchantRule.findMany({ where: { userId } }),
      prisma.financialConnection.findMany({ where: { userId } }),
      prisma.encryptedCredential.findMany({ where: { connection: { userId } } }),
      prisma.bankAccount.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId } }),
      prisma.fixedExpenseProfile.findMany({ where: { userId } }),
      prisma.monthlyBudget.findMany({ where: { userId } }),
      prisma.alertEvent.findMany({ where: { userId } })
    ]);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        categories,
        merchantRules,
        connections,
        credentials,
        accounts,
        transactions,
        fixedExpenseProfiles,
        monthlyBudgets,
        alertEvents
      }
    };

    const encrypted = encryptJson(payload);

    return NextResponse.json({ backup: encrypted });
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    return serverError();
  }
}
