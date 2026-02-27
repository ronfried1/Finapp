import { currentMonthKey } from "@/lib/date";
import { formatMoney } from "@/lib/format";
import { requirePageUser } from "@/lib/page-guard";
import { prisma } from "@/lib/db";
import { listTransactions } from "@/lib/services/transaction-service";
import { recategorizeTransactionAction } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { Card } from "@/components/card";

type Props = {
  searchParams: Promise<{ month?: string; search?: string; categoryId?: string; outliers?: string; page?: string }>;
};

export default async function TransactionsPage({ searchParams }: Props) {
  const { userId } = await requirePageUser();
  const query = await searchParams;

  const month = query.month ?? currentMonthKey();
  const search = query.search ?? "";
  const categoryId = query.categoryId ?? "";
  const onlyOutliers = query.outliers === "true";
  const page = Number(query.page ?? "1");

  const [categories, result] = await Promise.all([
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    listTransactions({
      userId,
      month,
      search: search || undefined,
      categoryId: categoryId || undefined,
      onlyOutliers,
      page,
      pageSize: 100
    })
  ]);

  return (
    <AppShell title="Transactions" subtitle="Searchable ledger with category edit and auditability.">
      <Card title="Filters" subtitle="Filter and inspect raw movements behind dashboard metrics.">
        <form className="inline" method="get" action="/transactions">
          <input name="month" type="month" defaultValue={month} />
          <input name="search" type="search" defaultValue={search} placeholder="Merchant or description" />
          <select name="categoryId" defaultValue={categoryId}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label>
            <input name="outliers" type="checkbox" defaultChecked={onlyOutliers} value="true" /> Only outliers
          </label>
          <button className="button ghost" type="submit">
            Apply
          </button>
        </form>
      </Card>

      <section className="card" style={{ marginTop: "0.9rem" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Description</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.occurredAt.slice(0, 10)}</td>
                  <td>{tx.merchant}</td>
                  <td>{tx.description}</td>
                  <td>{tx.direction}</td>
                  <td>{formatMoney(tx.amount)}</td>
                  <td>{tx.categoryName}</td>
                  <td>
                    <form action={recategorizeTransactionAction} className="inline">
                      <input type="hidden" name="transactionId" value={tx.id} />
                      <select name="categoryId" defaultValue={tx.categoryId}>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <label>
                        <input name="createRule" type="checkbox" /> rule
                      </label>
                      <button className="button ghost" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Showing {result.items.length} of {result.total} rows.
        </p>
      </section>
    </AppShell>
  );
}
