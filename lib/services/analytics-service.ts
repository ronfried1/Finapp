import { prisma } from "@/lib/db";
import { currentMonthKey, monthBounds, previousMonthKeys, startOfYear } from "@/lib/date";
import { DashboardSummary, SpendingAnalytics } from "@/lib/types";
import { decimalToNumber } from "@/lib/services/common";
import { listFixedExpenseProfiles } from "@/lib/services/fixed-expense-service";

function sumExpenses(transactions: Array<{ amount: unknown }>) {
  return transactions.reduce((sum, tx) => sum + Math.abs(decimalToNumber(tx.amount)), 0);
}

async function getMonthSpend(userId: string, monthKey: string): Promise<number> {
  const { start, end } = monthBounds(monthKey);
  const monthExpenses = await prisma.transaction.findMany({
    where: {
      userId,
      direction: "expense",
      occurredAt: { gte: start, lt: end }
    },
    select: { amount: true }
  });
  return sumExpenses(monthExpenses);
}

export async function getSpendingAnalytics(userId: string, month = currentMonthKey()): Promise<SpendingAnalytics> {
  const { start, end } = monthBounds(month);
  const prevMonths = previousMonthKeys(month, 6);

  const currentMonthExpenses = await prisma.transaction.findMany({
    where: { userId, direction: "expense", occurredAt: { gte: start, lt: end } },
    select: {
      amount: true,
      categoryId: true,
      merchantNormalized: true,
      category: true
    }
  });

  const currentSpend = sumExpenses(currentMonthExpenses.map((tx) => ({ amount: tx.amount })));
  const historicalSpends = await Promise.all(prevMonths.map((item) => getMonthSpend(userId, item)));
  const validHistorical = historicalSpends.filter((value) => value > 0);
  const sixMonthAverage = validHistorical.length
    ? validHistorical.reduce((sum, value) => sum + value, 0) / validHistorical.length
    : 0;

  const fixedProfiles = await listFixedExpenseProfiles(userId);
  const fixedNames = new Set(
    fixedProfiles
      .filter((profile) => profile.isConfirmed || !profile.isIgnored)
      .map((profile) => profile.merchantNormalized)
  );

  const variableCurrent = currentMonthExpenses
    .filter((tx) => !fixedNames.has(tx.merchantNormalized))
    .reduce((sum, tx) => sum + Math.abs(decimalToNumber(tx.amount)), 0);

  const variableHistory: number[] = [];
  for (const monthKey of prevMonths) {
    const window = monthBounds(monthKey);
    const expenses = await prisma.transaction.findMany({
      where: {
        userId,
        direction: "expense",
        occurredAt: { gte: window.start, lt: window.end }
      },
      select: { amount: true, merchantNormalized: true }
    });
    variableHistory.push(
      expenses
        .filter((tx) => !fixedNames.has(tx.merchantNormalized))
        .reduce((sum, tx) => sum + Math.abs(decimalToNumber(tx.amount)), 0)
    );
  }

  const variableAverage = variableHistory.length
    ? variableHistory.reduce((sum, value) => sum + value, 0) / variableHistory.length
    : 0;

  const categoryTotals = new Map<string, { name: string; color: string; amount: number }>();
  for (const tx of currentMonthExpenses) {
    const key = tx.categoryId;
    const existing = categoryTotals.get(key) ?? {
      name: tx.category.name,
      color: tx.category.color,
      amount: 0
    };
    existing.amount += Math.abs(decimalToNumber(tx.amount));
    categoryTotals.set(key, existing);
  }

  const topCategories = [...categoryTotals.entries()]
    .map(([categoryId, value]) => ({
      categoryId,
      name: value.name,
      color: value.color,
      amount: { amount: value.amount, currency: "ILS" as const }
    }))
    .sort((a, b) => b.amount.amount - a.amount.amount)
    .slice(0, 5);

  const spendVsTypicalPct = sixMonthAverage > 0 ? ((currentSpend - sixMonthAverage) / sixMonthAverage) * 100 : 0;

  return {
    month,
    currentMonthSpend: { amount: currentSpend, currency: "ILS" },
    sixMonthAverageSpend: { amount: sixMonthAverage, currency: "ILS" },
    spendVsTypicalPct,
    variableSpendCurrent: { amount: variableCurrent, currency: "ILS" },
    variableSpendAverage: { amount: variableAverage, currency: "ILS" },
    topCategories
  };
}

export async function getDashboardSummary(userId: string, month = currentMonthKey()): Promise<DashboardSummary> {
  const { start, end } = monthBounds(month);
  const yearStart = startOfYear(start);

  const [accounts, monthTx, ytdTx, fixedProfiles, spending, budget, openAlerts] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId }, select: { lastBalance: true } }),
    prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: start, lt: end } },
      select: { amount: true, direction: true }
    }),
    prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: yearStart, lt: end } },
      select: { amount: true, direction: true }
    }),
    listFixedExpenseProfiles(userId),
    getSpendingAnalytics(userId, month),
    prisma.monthlyBudget.findUnique({ where: { userId_month: { userId, month } } }),
    prisma.alertEvent.count({ where: { userId, resolvedAt: null } })
  ]);

  const cashPosition = accounts.reduce((sum, account) => sum + decimalToNumber(account.lastBalance), 0);

  const netCashflowMonth = monthTx.reduce((sum, tx) => {
    const amount = decimalToNumber(tx.amount);
    return tx.direction === "income" ? sum + Math.abs(amount) : sum - Math.abs(amount);
  }, 0);

  const netCashflowYtd = ytdTx.reduce((sum, tx) => {
    const amount = decimalToNumber(tx.amount);
    return tx.direction === "income" ? sum + Math.abs(amount) : sum - Math.abs(amount);
  }, 0);

  const fixedExpensesMonthly = fixedProfiles
    .filter((profile) => profile.isConfirmed || !profile.isIgnored)
    .reduce((sum, profile) => sum + decimalToNumber(profile.avgMonthlyAmount), 0);

  const fixedExpenseCoverageMonths = fixedExpensesMonthly > 0 ? cashPosition / fixedExpensesMonthly : 99;

  const monthSpend = spending.currentMonthSpend.amount;
  const monthlyBudgetCap = budget ? decimalToNumber(budget.capAmount) : undefined;

  return {
    month,
    cashPosition: { amount: cashPosition, currency: "ILS" },
    netCashflowMonth: { amount: netCashflowMonth, currency: "ILS" },
    netCashflowYtd: { amount: netCashflowYtd, currency: "ILS" },
    fixedExpenseCoverageMonths,
    spendVsTypicalPct: spending.spendVsTypicalPct,
    monthlyBudgetCap: monthlyBudgetCap !== undefined ? { amount: monthlyBudgetCap, currency: "ILS" } : undefined,
    monthlyBudgetDelta:
      monthlyBudgetCap !== undefined
        ? { amount: monthlyBudgetCap - monthSpend, currency: "ILS" }
        : undefined,
    openAlerts
  };
}
