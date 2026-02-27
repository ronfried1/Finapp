import { Prisma } from "@prisma/client";

export function decimalToNumber(value: Prisma.Decimal | number | string | unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number((value as { toString(): string }).toString());
  }
  return Number(value);
}

export function monthKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 7);
}
