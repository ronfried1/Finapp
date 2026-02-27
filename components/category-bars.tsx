import { formatMoney } from "@/lib/format";

export function CategoryBars(props: {
  items: Array<{ name: string; color: string; amount: { amount: number; currency: "ILS" } }>;
}) {
  const total = props.items.reduce((sum, item) => sum + item.amount.amount, 0);

  return (
    <div className="bars">
      {props.items.map((item) => {
        const ratio = total > 0 ? (item.amount.amount / total) * 100 : 0;
        return (
          <div key={item.name} className="bar-row">
            <div className="bar-meta">
              <span>{item.name}</span>
              <span>{formatMoney(item.amount.amount, item.amount.currency)}</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max(ratio, 2)}%`, background: item.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
