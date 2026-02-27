import { currentMonthKey } from "@/lib/date";
import { formatMoney } from "@/lib/format";
import { requirePageUser } from "@/lib/page-guard";
import { getMonthlyBudget } from "@/lib/services/budget-service";
import { getSpendingAnalytics } from "@/lib/services/analytics-service";
import { setMonthlyBudgetAction } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { Kpi } from "@/components/kpi";
import { Card } from "@/components/card";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export default async function BudgetPage({ searchParams }: Props) {
  const { userId } = await requirePageUser();
  const query = await searchParams;
  const month = query.month ?? currentMonthKey();

  const [budget, analytics] = await Promise.all([
    getMonthlyBudget(userId, month),
    getSpendingAnalytics(userId, month)
  ]);

  const cap = budget?.capAmount ?? 0;
  const spent = analytics.currentMonthSpend.amount;
  const delta = cap - spent;

  return (
    <AppShell title="Budget" subtitle="Simple monthly overall cap with current spend delta.">
      <section className="grid kpis">
        <Kpi label="Monthly Cap" value={cap ? formatMoney(cap) : "Not set"} />
        <Kpi label="Current Spend" value={formatMoney(spent)} tone={spent > cap && cap > 0 ? "bad" : "default"} />
        <Kpi label="Remaining" value={cap ? formatMoney(delta) : "-"} tone={delta >= 0 ? "good" : "bad"} />
      </section>

      <section className="card" style={{ marginTop: "0.9rem" }}>
        <form className="inline" action={setMonthlyBudgetAction}>
          <input type="hidden" name="month" value={month} />
          <label htmlFor="month">Month</label>
          <input id="month" type="month" defaultValue={month} disabled />
          <label htmlFor="capAmount">Monthly cap</label>
          <input id="capAmount" name="capAmount" type="number" step="0.01" min="1" defaultValue={cap || undefined} required />
          <button className="button" type="submit">
            Save cap
          </button>
        </form>
      </section>
    </AppShell>
  );
}
