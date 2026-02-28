"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { clearPasscodeVerifiedCookie, hashPasscode, setPasscodeVerifiedCookie, verifyPasscode } from "@/lib/passcode";
import { createConnectionWithCredentials } from "@/lib/services/connection-service";
import { ensureDefaultCategories } from "@/lib/services/category-service";
import { startConnectionSync, submitSyncChallenge } from "@/lib/services/sync-service";
import { setMonthlyBudget } from "@/lib/services/budget-service";
import { recategorizeTransaction } from "@/lib/services/transaction-service";
import { resolveAlert } from "@/lib/services/alert-service";
import { setFixedExpenseConfirmation } from "@/lib/services/fixed-expense-service";
import { normalizeMerchant } from "@/lib/format";

export async function createConnectionAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const provider = String(formData.get("provider") ?? "israeli-bank-scrapers");
  const displayName = String(formData.get("displayName") ?? "");
  const institution = String(formData.get("institution") ?? "");
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();
  const card6Digits = String(formData.get("card6Digits") ?? "").trim();
  const institutionKey = institution.trim().toLowerCase();

  if (!displayName || !institution || !username || !password) {
    throw new Error("Missing required fields");
  }

  const isDiscount = ["discount", "discount bank", "דיסקונט"].includes(institutionKey);
  const isIsracard = ["isracard", "isracart", "isra card", "ישראכרט"].includes(institutionKey);

  if (isDiscount && !accountNumber) {
    throw new Error("Discount requires account number.");
  }

  if (isIsracard && !/^\d{6}$/.test(card6Digits)) {
    throw new Error("Isracard requires 6 card digits.");
  }

  await ensureDefaultCategories(userId);

  await createConnectionWithCredentials({
    userId,
    provider,
    displayName,
    credentials: {
      institution,
      username,
      password,
      accountNumber: accountNumber || undefined,
      card6Digits: card6Digits || undefined
    }
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function syncConnectionAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) {
    throw new Error("Missing connection ID");
  }

  await startConnectionSync(userId, connectionId);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/fixed-expenses");
}

export async function submitChallengeAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const challengeId = String(formData.get("challengeId") ?? "");
  const otpCode = String(formData.get("otpCode") ?? "");

  if (!challengeId || !otpCode) {
    throw new Error("Missing challenge data");
  }

  await submitSyncChallenge(userId, challengeId, otpCode);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function setMonthlyBudgetAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const month = String(formData.get("month") ?? "");
  const capAmount = Number(formData.get("capAmount") ?? "0");
  if (!month || !Number.isFinite(capAmount) || capAmount <= 0) {
    throw new Error("Invalid budget");
  }

  await setMonthlyBudget(userId, month, capAmount);
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

export async function recategorizeTransactionAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const transactionId = String(formData.get("transactionId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const createRule = formData.get("createRule") === "on";

  if (!transactionId || !categoryId) {
    throw new Error("Missing transaction or category");
  }

  await recategorizeTransaction({ userId, transactionId, categoryId, createRule });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function resolveAlertAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const alertId = String(formData.get("alertId") ?? "");
  if (!alertId) {
    throw new Error("Missing alert ID");
  }

  await resolveAlert(userId, alertId);
  revalidatePath("/dashboard");
}

export async function setFixedExpenseConfirmationAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const isConfirmed = String(formData.get("isConfirmed") ?? "false") === "true";

  if (!id) {
    throw new Error("Missing item");
  }

  await setFixedExpenseConfirmation(userId, id, isConfirmed);
  revalidatePath("/fixed-expenses");
  revalidatePath("/dashboard");
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#6b7280");

  if (!name) {
    throw new Error("Name is required");
  }

  await prisma.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, color, isSystem: false },
    update: { color }
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function createMerchantRuleAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const merchant = String(formData.get("merchant") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!merchant || !categoryId) {
    throw new Error("Merchant and category are required");
  }

  await prisma.merchantRule.upsert({
    where: {
      userId_merchantNormalized: {
        userId,
        merchantNormalized: normalizeMerchant(merchant)
      }
    },
    create: {
      userId,
      merchantNormalized: normalizeMerchant(merchant),
      categoryId
    },
    update: {
      categoryId
    }
  });

  revalidatePath("/categories");
}

export async function setPasscodeAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const passcode = String(formData.get("passcode") ?? "");
  if (!/^\d{4,8}$/.test(passcode)) {
    throw new Error("Passcode must be 4-8 digits");
  }

  const hash = await hashPasscode(passcode);
  await prisma.appPasscode.upsert({
    where: { userId },
    create: { userId, hash, enabled: true },
    update: { hash, enabled: true, failedCount: 0, lockedUntil: null }
  });
  await setPasscodeVerifiedCookie(userId);

  revalidatePath("/settings/security");
}

export async function verifyPasscodeAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const passcode = String(formData.get("passcode") ?? "");
  const record = await prisma.appPasscode.findUnique({ where: { userId } });

  if (!record?.enabled) {
    throw new Error("Passcode is not enabled");
  }

  const valid = await verifyPasscode(passcode, record.hash);
  if (!valid) {
    await prisma.appPasscode.update({
      where: { userId },
      data: { failedCount: { increment: 1 } }
    });
    throw new Error("Invalid passcode");
  }

  await prisma.appPasscode.update({
    where: { userId },
    data: { failedCount: 0, lockedUntil: null }
  });

  await setPasscodeVerifiedCookie(userId);
  revalidatePath("/dashboard");
}

export async function disablePasscodeAction(): Promise<void> {
  const userId = await requireUserId();
  await prisma.appPasscode.upsert({
    where: { userId },
    create: {
      userId,
      hash: "disabled",
      enabled: false
    },
    update: {
      enabled: false,
      failedCount: 0,
      lockedUntil: null
    }
  });

  await clearPasscodeVerifiedCookie();
  revalidatePath("/settings/security");
}
