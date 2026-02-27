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

type ActionResult = { ok: boolean; message?: string };

export async function createConnectionAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const provider = String(formData.get("provider") ?? "israeli-bank-scrapers");
  const displayName = String(formData.get("displayName") ?? "");
  const institution = String(formData.get("institution") ?? "");
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!displayName || !institution || !username || !password) {
    return { ok: false, message: "Missing required fields" };
  }

  await ensureDefaultCategories(userId);

  await createConnectionWithCredentials({
    userId,
    provider,
    displayName,
    credentials: {
      institution,
      username,
      password
    }
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function syncConnectionAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) {
    return { ok: false, message: "Missing connection ID" };
  }

  try {
    const result = await startConnectionSync(userId, connectionId);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/fixed-expenses");

    if (result.status === "challenge_required") {
      return { ok: true, message: `Challenge required: ${result.challengeId}` };
    }

    return { ok: true, message: "Sync completed" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Sync failed" };
  }
}

export async function submitChallengeAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const challengeId = String(formData.get("challengeId") ?? "");
  const otpCode = String(formData.get("otpCode") ?? "");

  if (!challengeId || !otpCode) {
    return { ok: false, message: "Missing challenge data" };
  }

  try {
    await submitSyncChallenge(userId, challengeId, otpCode);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    return { ok: true, message: "Challenge resolved" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "OTP failed" };
  }
}

export async function setMonthlyBudgetAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const month = String(formData.get("month") ?? "");
  const capAmount = Number(formData.get("capAmount") ?? "0");
  if (!month || !Number.isFinite(capAmount) || capAmount <= 0) {
    return { ok: false, message: "Invalid budget" };
  }

  await setMonthlyBudget(userId, month, capAmount);
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function recategorizeTransactionAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const transactionId = String(formData.get("transactionId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const createRule = formData.get("createRule") === "on";

  if (!transactionId || !categoryId) {
    return { ok: false, message: "Missing transaction or category" };
  }

  await recategorizeTransaction({ userId, transactionId, categoryId, createRule });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function resolveAlertAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const alertId = String(formData.get("alertId") ?? "");
  if (!alertId) {
    return { ok: false, message: "Missing alert ID" };
  }

  await resolveAlert(userId, alertId);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setFixedExpenseConfirmationAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const isConfirmed = String(formData.get("isConfirmed") ?? "false") === "true";

  if (!id) {
    return { ok: false, message: "Missing item" };
  }

  await setFixedExpenseConfirmation(userId, id, isConfirmed);
  revalidatePath("/fixed-expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#6b7280");

  if (!name) {
    return { ok: false, message: "Name is required" };
  }

  await prisma.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, color, isSystem: false },
    update: { color }
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function createMerchantRuleAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const merchant = String(formData.get("merchant") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!merchant || !categoryId) {
    return { ok: false, message: "Merchant and category are required" };
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
  return { ok: true };
}

export async function setPasscodeAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const passcode = String(formData.get("passcode") ?? "");
  if (!/^\d{4,8}$/.test(passcode)) {
    return { ok: false, message: "Passcode must be 4-8 digits" };
  }

  const hash = await hashPasscode(passcode);
  await prisma.appPasscode.upsert({
    where: { userId },
    create: { userId, hash, enabled: true },
    update: { hash, enabled: true, failedCount: 0, lockedUntil: null }
  });
  await setPasscodeVerifiedCookie(userId);

  revalidatePath("/settings/security");
  return { ok: true, message: "Passcode enabled" };
}

export async function verifyPasscodeAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const passcode = String(formData.get("passcode") ?? "");
  const record = await prisma.appPasscode.findUnique({ where: { userId } });

  if (!record?.enabled) {
    return { ok: false, message: "Passcode is not enabled" };
  }

  const valid = await verifyPasscode(passcode, record.hash);
  if (!valid) {
    await prisma.appPasscode.update({
      where: { userId },
      data: { failedCount: { increment: 1 } }
    });
    return { ok: false, message: "Invalid passcode" };
  }

  await prisma.appPasscode.update({
    where: { userId },
    data: { failedCount: 0, lockedUntil: null }
  });

  await setPasscodeVerifiedCookie(userId);
  revalidatePath("/dashboard");
  return { ok: true, message: "Unlocked" };
}

export async function disablePasscodeAction(): Promise<ActionResult> {
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
  return { ok: true, message: "Passcode disabled" };
}
