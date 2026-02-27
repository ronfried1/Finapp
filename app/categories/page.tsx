import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/page-guard";
import { createCategoryAction, createMerchantRuleAction } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { Card } from "@/components/card";

export default async function CategoriesPage() {
  const { userId } = await requirePageUser();

  const [categories, rules] = await Promise.all([
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.merchantRule.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { merchantNormalized: "asc" },
      take: 200
    })
  ]);

  return (
    <AppShell title="Categories & Rules" subtitle="Default categories with editable merchant routing rules.">
      <section className="grid cols-2">
        <Card title="Create / Update Category" subtitle="Color + naming for dashboard breakdowns">
          <form action={createCategoryAction} className="inline">
            <input name="name" placeholder="Category name" required />
            <input name="color" type="color" defaultValue="#0f766e" />
            <button className="button" type="submit">
              Save category
            </button>
          </form>

          <div className="table-wrap" style={{ marginTop: "0.8rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Color</th>
                  <th>System</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: category.color
                        }}
                      />
                    </td>
                    <td>{category.isSystem ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Merchant Rules" subtitle="Auto-assign future transactions by merchant pattern">
          <form action={createMerchantRuleAction} className="inline">
            <input name="merchant" placeholder="Merchant name" required />
            <select name="categoryId" required>
              <option value="">Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button className="button" type="submit">
              Save rule
            </button>
          </form>

          <div className="table-wrap" style={{ marginTop: "0.8rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Merchant key</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.merchantNormalized}</td>
                    <td>{rule.category.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
