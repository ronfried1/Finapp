import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentMonthKey } from "@/lib/date";
import { formatMoney, formatPercent } from "@/lib/format";
import { requirePageUser } from "@/lib/page-guard";
import { getDashboardSummary, getSpendingAnalytics } from "@/lib/services/analytics-service";
import { listTransactions } from "@/lib/services/transaction-service";
import { AppShell } from "@/components/shell";
import { Kpi } from "@/components/kpi";
import { Card } from "@/components/card";
import { CategoryBars } from "@/components/category-bars";
import { AlertList } from "@/components/alert-list";

type Props = {
  searchParams: Promise<{ month?: string; mode?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const { userId } = await requirePageUser();
  const query = await searchParams;
  const month = query.month ?? currentMonthKey();
  const mode = query.mode === "analyst" ? "analyst" : "minimal";

  const [summary, spending, alerts, recentTx] = await Promise.all([
    getDashboardSummary(userId, month),
    getSpendingAnalytics(userId, month),
    prisma.alertEvent.findMany({ where: { userId, resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 8 }),
    listTransactions({ userId, month, page: 1, pageSize: 8 })
  ]);

  return (
    <AppShell title="Dashboard" subtitle="At-a-glance spending control with an optional analyst layer.">
      <div className="card" style={{ marginBottom: "0.9rem" }}>
        <form className="inline" action="/dashboard" method="get">
          <label htmlFor="month">Month</label>
          <input id="month" name="month" type="month" defaultValue={month} />
          <input type="hidden" name="mode" value={mode} />
          <button className="button ghost" type="submit">
            Apply
          </button>
          <Link className="button" href={`/dashboard?month=${month}&mode=${mode === "minimal" ? "analyst" : "minimal"}`}>
            {mode === "minimal" ? "Switch to Analyst" : "Switch to Minimal"}
          </Link>
        </form>
      </div>

      <section className="grid kpis">
        <Kpi label="Cash Position" value={formatMoney(summary.cashPosition.amount)} hint="Bank + cards impact" />
        <Kpi
          label="Net Cash Flow (Month)"
          value={formatMoney(summary.netCashflowMonth.amount)}
          tone={summary.netCashflowMonth.amount >= 0 ? "good" : "bad"}
        />
        <Kpi
          label="Fixed Expense Coverage"
          value={`${summary.fixedExpenseCoverageMonths.toFixed(1)} months`}
          tone={summary.fixedExpenseCoverageMonths < 2 ? "bad" : "good"}
        />
        <Kpi
          label="Spend vs Typical"
          value={formatPercent(summary.spendVsTypicalPct)}
          tone={summary.spendVsTypicalPct > 15 ? "bad" : "default"}
        />
      </section>

      <section className="grid cols-2" style={{ marginTop: "0.9rem" }}>
        <Card title="Top Categories" subtitle="Current month top five categories">
          <CategoryBars items={spending.topCategories} />
        </Card>
        <Card title="Alerts" subtitle="Rule-based anomaly and control signals">
          <AlertList
            items={alerts.map((item) => ({
              id: item.id,
              type: item.type,
              message: item.message,
              severity: item.severity,
              createdAt: item.createdAt
            }))}
          />
        </Card>
      </section>

      {mode === "analyst" ? (
        <section className="grid cols-2" style={{ marginTop: "0.9rem" }}>
          <Card title="Spending Diagnostics" subtitle="Current vs historical and variable-spend view">
            <ul>
              <li>Current month spend: {formatMoney(spending.currentMonthSpend.amount)}</li>
              <li>6-month average: {formatMoney(spending.sixMonthAverageSpend.amount)}</li>
              <li>Variable spend this month: {formatMoney(spending.variableSpendCurrent.amount)}</li>
              <li>Variable spend average: {formatMoney(spending.variableSpendAverage.amount)}</li>
              <li>Open alerts: {summary.openAlerts}</li>
              <li>Budget delta: {summary.monthlyBudgetDelta ? formatMoney(summary.monthlyBudgetDelta.amount) : "Not set"}</li>
            </ul>
          </Card>

          <Card title="Recent Transactions" subtitle="Audit trail for current month calculations">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.items.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.occurredAt.slice(0, 10)}</td>
                      <td>{tx.merchant}</td>
                      <td>{tx.categoryName}</td>
                      <td>{formatMoney(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              <Link href={`/transactions?month=${month}`}>Open full transaction ledger</Link>
            </p>
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
