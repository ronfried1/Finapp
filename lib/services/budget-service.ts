import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/services/common";

export async function setMonthlyBudget(userId: string, month: string, capAmount: number) {
  const result = await prisma.monthlyBudget.upsert({
    where: {
      userId_month: { userId, month }
    },
    create: {
      userId,
      month,
      capAmount
    },
    update: {
      capAmount
    }
  });

  return {
    id: result.id,
    month: result.month,
    capAmount: decimalToNumber(result.capAmount)
  };
}

export async function getMonthlyBudget(userId: string, month: string) {
  const result = await prisma.monthlyBudget.findUnique({
    where: {
      userId_month: { userId, month }
    }
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    month: result.month,
    capAmount: decimalToNumber(result.capAmount)
  };
}
