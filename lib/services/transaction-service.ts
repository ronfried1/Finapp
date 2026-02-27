import { prisma } from "@/lib/db";
import { monthBounds } from "@/lib/date";
import { normalizeMerchant } from "@/lib/format";
import { decimalToNumber } from "@/lib/services/common";
import { ApiTransaction } from "@/lib/types";

export async function listTransactions(input: {
  userId: string;
  month: string;
  search?: string;
  categoryId?: string;
  onlyOutliers?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const { start, end } = monthBounds(input.month);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 50;

  const where = {
    userId: input.userId,
    occurredAt: { gte: start, lt: end },
    ...(input.onlyOutliers ? { isOutlier: true } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.search
      ? {
          OR: [
            { merchant: { contains: input.search, mode: "insensitive" as const } },
            { description: { contains: input.search, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { category: true, bankAccount: true },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const items: ApiTransaction[] = rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    postedAt: row.postedAt?.toISOString(),
    accountId: row.bankAccountId,
    merchant: row.merchant,
    description: row.description,
    amount: decimalToNumber(row.amount),
    direction: row.direction,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    sourceCategory: row.sourceCategory ?? undefined,
    isOutlier: row.isOutlier,
    sourceExternalId: row.sourceExternalId
  }));

  return {
    page,
    pageSize,
    total,
    items
  };
}

export async function recategorizeTransaction(input: {
  userId: string;
  transactionId: string;
  categoryId: string;
  createRule?: boolean;
}) {
  const tx = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      userId: input.userId
    }
  });

  if (!tx) {
    throw new Error("Transaction not found");
  }

  await prisma.transaction.update({
    where: { id: tx.id },
    data: { categoryId: input.categoryId }
  });

  if (input.createRule) {
    await prisma.merchantRule.upsert({
      where: {
        userId_merchantNormalized: {
          userId: input.userId,
          merchantNormalized: normalizeMerchant(tx.merchant)
        }
      },
      create: {
        userId: input.userId,
        merchantNormalized: normalizeMerchant(tx.merchant),
        categoryId: input.categoryId
      },
      update: {
        categoryId: input.categoryId
      }
    });
  }

  return { ok: true };
}
