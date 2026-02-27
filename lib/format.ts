export function formatMoney(value: number, currency = "ILS"): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function normalizeMerchant(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}
