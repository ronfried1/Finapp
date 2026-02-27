import { decimalToNumber } from "@/lib/services/common";
import { requirePageUser } from "@/lib/page-guard";
import { listFixedExpenseProfiles } from "@/lib/services/fixed-expense-service";
import { formatMoney } from "@/lib/format";
import { setFixedExpenseConfirmationAction } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { Card } from "@/components/card";

export default async function FixedExpensesPage() {
  const { userId } = await requirePageUser();
  const profiles = await listFixedExpenseProfiles(userId);

  return (
    <AppShell title="Fixed Expense Stability" subtitle="Auto-suggested recurring expenses with manual control.">
      <Card title="Detected fixed items" subtitle="Recurring 3/4+ month patterns with anomaly flags">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Category</th>
                <th>Average</th>
                <th>Latest</th>
                <th>Std Dev</th>
                <th>Confirmed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.merchantNormalized}</td>
                  <td>{profile.category.name}</td>
                  <td>{formatMoney(decimalToNumber(profile.avgMonthlyAmount))}</td>
                  <td>{formatMoney(decimalToNumber(profile.latestAmount))}</td>
                  <td>{formatMoney(decimalToNumber(profile.stdDevAmount))}</td>
                  <td>{profile.isConfirmed ? "yes" : "no"}</td>
                  <td>
                    <form action={setFixedExpenseConfirmationAction} className="inline">
                      <input type="hidden" name="id" value={profile.id} />
                      <input type="hidden" name="isConfirmed" value={profile.isConfirmed ? "false" : "true"} />
                      <button className="button ghost" type="submit">
                        {profile.isConfirmed ? "Unconfirm" : "Confirm"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
