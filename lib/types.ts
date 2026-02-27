export type Money = { amount: number; currency: "ILS" };

export type DashboardSummary = {
  month: string;
  cashPosition: Money;
  netCashflowMonth: Money;
  netCashflowYtd: Money;
  fixedExpenseCoverageMonths: number;
  spendVsTypicalPct: number;
  monthlyBudgetCap?: Money;
  monthlyBudgetDelta?: Money;
  openAlerts: number;
};

export type ApiTransaction = {
  id: string;
  occurredAt: string;
  postedAt?: string;
  accountId: string;
  merchant: string;
  description: string;
  amount: number;
  direction: "income" | "expense";
  categoryId: string;
  categoryName: string;
  sourceCategory?: string;
  isOutlier: boolean;
  sourceExternalId?: string;
};

export type AlertEventDto = {
  id: string;
  type: "low_cash_buffer" | "overspending" | "unusual_tx" | "fixed_bill_anomaly";
  severity: "low" | "medium" | "high";
  message: string;
  createdAt: string;
  resolvedAt?: string;
  metadata: Record<string, unknown>;
};

export type SpendingAnalytics = {
  month: string;
  currentMonthSpend: Money;
  sixMonthAverageSpend: Money;
  spendVsTypicalPct: number;
  variableSpendCurrent: Money;
  variableSpendAverage: Money;
  topCategories: Array<{ categoryId: string; name: string; amount: Money; color: string }>;
};
