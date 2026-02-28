import { prisma } from "@/lib/db";
import { monthBounds, previousMonthKeys } from "@/lib/date";
import { decimalToNumber } from "@/lib/services/common";
import { listFixedExpenseProfiles } from "@/lib/services/fixed-expense-service";

type AlertInput = {
  type: "low_cash_buffer" | "overspending" | "unusual_tx" | "fixed_bill_anomaly";
  severity: "low" | "medium" | "high";
  message: string;
  metadata: Record<string, unknown>;
};

async function createAlertIfMissing(userId: string, input: AlertInput) {
  const signature = JSON.stringify({
    type: input.type,
    month: input.metadata.month,
    key: input.metadata.key ?? input.message
  });

  const existing = await prisma.alertEvent.findMany({
    where: {
      userId,
      type: input.type,
      resolvedAt: null
    },
    select: { metadata: true },
    take: 200
  });

  const duplicate = existing.some((event) => {
    if (!event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) {
      return false;
    }
    const value = (event.metadata as Record<string, unknown>).signature;
    return typeof value === "string" && value === signature;
  });
  if (duplicate) return;

  await prisma.alertEvent.create({
    data: {
      userId,
      type: input.type,
      severity: input.severity,
      message: input.message,
      metadata: {
        ...input.metadata,
        signature
      }
    }
  });
}

export async function evaluateAlertsForMonth(userId: string, monthKey: string) {
  const alerts: AlertInput[] = [];
  const { start, end } = monthBounds(monthKey);
  const previousMonths = previousMonthKeys(monthKey, 6);

  const accounts = await prisma.bankAccount.findMany({ where: { userId } });
  const cashPosition = accounts.reduce((sum, acc) => sum + decimalToNumber(acc.lastBalance), 0);

  const fixedProfiles = await listFixedExpenseProfiles(userId);
  const fixedMonthly = fixedProfiles
    .filter((profile) => profile.isConfirmed || !profile.isIgnored)
    .reduce((sum, profile) => sum + decimalToNumber(profile.avgMonthlyAmount), 0);

  const coverageMonths = fixedMonthly > 0 ? cashPosition / fixedMonthly : 99;
  if (coverageMonths < 2) {
    alerts.push({
      type: "low_cash_buffer",
      severity: "high",
      message: `Cash buffer is low (${coverageMonths.toFixed(1)} months).`,
      metadata: { month: monthKey, coverageMonths }
    });
  }

  const thisMonthExpenses = await prisma.transaction.findMany({
    where: {
      userId,
      direction: "expense",
      occurredAt: { gte: start, lt: end }
    },
    select: { amount: true }
  });
  const currentSpend = thisMonthExpenses.reduce((sum, tx) => sum + Math.abs(decimalToNumber(tx.amount)), 0);

  const averageCandidates: number[] = [];
  for (const prevMonthKey of previousMonths) {
    const prev = monthBounds(prevMonthKey);
    const prevExpenses = await prisma.transaction.findMany({
      where: {
        userId,
        direction: "expense",
        occurredAt: { gte: prev.start, lt: prev.end }
      },
      select: { amount: true }
    });

    const monthSpend = prevExpenses.reduce((sum, tx) => sum + Math.abs(decimalToNumber(tx.amount)), 0);
    if (monthSpend > 0) {
      averageCandidates.push(monthSpend);
    }
  }

  const avgSpend = averageCandidates.length
    ? averageCandidates.reduce((sum, value) => sum + value, 0) / averageCandidates.length
    : 0;

  if (avgSpend > 0 && currentSpend > avgSpend * 1.15) {
    alerts.push({
      type: "overspending",
      severity: "medium",
      message: `Current month spend is ${(currentSpend / avgSpend * 100 - 100).toFixed(1)}% above your typical level.`,
      metadata: { month: monthKey, currentSpend, avgSpend }
    });
  }

  const recentExpenses = await prisma.transaction.findMany({
    where: {
      userId,
      direction: "expense",
      occurredAt: { gte: start, lt: end }
    },
    orderBy: { occurredAt: "desc" },
    take: 250
  });

  const byMerchant = new Map<string, number[]>();
  for (const tx of recentExpenses) {
    const bucket = byMerchant.get(tx.merchantNormalized) ?? [];
    bucket.push(Math.abs(decimalToNumber(tx.amount)));
    byMerchant.set(tx.merchantNormalized, bucket);
  }

  for (const tx of recentExpenses) {
    const values = byMerchant.get(tx.merchantNormalized) ?? [];
    if (values.length < 3) continue;

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const delta = Math.abs(Math.abs(decimalToNumber(tx.amount)) - avg);
    if (delta > Math.max(avg * 0.8, 120)) {
      alerts.push({
        type: "unusual_tx",
        severity: "medium",
        message: `Unusual transaction detected for ${tx.merchant}.`,
        metadata: { month: monthKey, key: tx.id, merchant: tx.merchant, amount: decimalToNumber(tx.amount), avg }
      });
      break;
    }
  }

  for (const profile of fixedProfiles) {
    const latest = decimalToNumber(profile.latestAmount);
    const avg = decimalToNumber(profile.avgMonthlyAmount);
    const sd = decimalToNumber(profile.stdDevAmount);
    const threshold = avg + Math.max(sd * 2, avg * 0.2);
    if (latest > threshold) {
      alerts.push({
        type: "fixed_bill_anomaly",
        severity: "medium",
        message: `Fixed expense anomaly: ${profile.merchantNormalized} latest charge is above normal range.`,
        metadata: {
          month: monthKey,
          key: profile.id,
          merchant: profile.merchantNormalized,
          latest,
          avg,
          threshold
        }
      });
    }
  }

  for (const alert of alerts) {
    await createAlertIfMissing(userId, alert);
  }
}

export async function listAlerts(userId: string, onlyOpen: boolean) {
  return prisma.alertEvent.findMany({
    where: {
      userId,
      ...(onlyOpen ? { resolvedAt: null } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function resolveAlert(userId: string, alertId: string) {
  return prisma.alertEvent.updateMany({
    where: { id: alertId, userId, resolvedAt: null },
    data: { resolvedAt: new Date() }
  });
}
