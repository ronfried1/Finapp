export function currentMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export function startOfYear(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

export function previousMonthKeys(monthKey: string, count: number): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  const out: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  for (let i = 0; i < count; i += 1) {
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    out.push(cursor.toISOString().slice(0, 7));
  }
  return out;
}
