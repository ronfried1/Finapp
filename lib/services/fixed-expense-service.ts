import { prisma } from "@/lib/db";
import { decimalToNumber, monthKeyFromDate } from "@/lib/services/common";

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function recomputeFixedExpenseProfiles(userId: string) {
  const lookbackStart = new Date();
  lookbackStart.setUTCMonth(lookbackStart.getUTCMonth() - 4);

  const expenses = await prisma.transaction.findMany({
    where: {
      userId,
      direction: "expense",
      occurredAt: { gte: lookbackStart }
    },
    select: {
      merchantNormalized: true,
      amount: true,
      categoryId: true,
      occurredAt: true
    }
  });

  const grouped = new Map<string, { amounts: number[]; months: Set<string>; categoryId: string; latestDate: Date }>();

  for (const tx of expenses) {
    const amount = Math.abs(decimalToNumber(tx.amount));
    const month = monthKeyFromDate(tx.occurredAt);
    const existing = grouped.get(tx.merchantNormalized);
    if (!existing) {
      grouped.set(tx.merchantNormalized, {
        amounts: [amount],
        months: new Set([month]),
        categoryId: tx.categoryId,
        latestDate: tx.occurredAt
      });
      continue;
    }

    existing.amounts.push(amount);
    existing.months.add(month);
    if (tx.occurredAt > existing.latestDate) {
      existing.latestDate = tx.occurredAt;
    }
  }

  for (const [merchantNormalized, stats] of grouped.entries()) {
    if (stats.months.size < 3) {
      continue;
    }

    const avg = mean(stats.amounts);
    const latest = stats.amounts[stats.amounts.length - 1] ?? avg;
    const sd = stdDev(stats.amounts);

    await prisma.fixedExpenseProfile.upsert({
      where: {
        userId_merchantNormalized: {
          userId,
          merchantNormalized
        }
      },
      create: {
        userId,
        merchantNormalized,
        categoryId: stats.categoryId,
        avgMonthlyAmount: avg,
        latestAmount: latest,
        stdDevAmount: sd,
        lastObservedAt: stats.latestDate,
        isConfirmed: false
      },
      update: {
        avgMonthlyAmount: avg,
        latestAmount: latest,
        stdDevAmount: sd,
        lastObservedAt: stats.latestDate
      }
    });
  }
}

export async function listFixedExpenseProfiles(userId: string) {
  return prisma.fixedExpenseProfile.findMany({
    where: {
      userId,
      isIgnored: false
    },
    include: {
      category: true
    },
    orderBy: { avgMonthlyAmount: "desc" }
  });
}

export async function setFixedExpenseConfirmation(userId: string, id: string, isConfirmed: boolean) {
  return prisma.fixedExpenseProfile.updateMany({
    where: { id, userId },
    data: { isConfirmed }
  });
}
