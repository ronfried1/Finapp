import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decryptJson, EncryptedPayload } from "@/lib/crypto";
import { requireApiAccess } from "@/lib/guard";
import { badRequest, serverError, unauthorized } from "@/lib/http";

const BodySchema = z.object({
  backup: z.object({
    iv: z.string(),
    tag: z.string(),
    ciphertext: z.string(),
    algorithm: z.literal("aes-256-gcm"),
    keyVersion: z.number()
  })
});

export async function POST(request: Request) {
  try {
    const userId = await requireApiAccess();
    const body = BodySchema.parse(await request.json());

    const payload = decryptJson<{
      version: number;
      data: {
        categories: Array<any>;
        merchantRules: Array<any>;
        connections: Array<any>;
        credentials: Array<any>;
        accounts: Array<any>;
        transactions: Array<any>;
        fixedExpenseProfiles: Array<any>;
        monthlyBudgets: Array<any>;
        alertEvents: Array<any>;
      };
    }>(body.backup as EncryptedPayload);

    await prisma.$transaction(async (tx) => {
      for (const category of payload.data.categories) {
        await tx.category.upsert({
          where: { id: category.id },
          update: {
            name: category.name,
            color: category.color,
            isSystem: category.isSystem
          },
          create: {
            id: category.id,
            userId,
            name: category.name,
            color: category.color,
            isSystem: category.isSystem
          }
        });
      }

      for (const connection of payload.data.connections) {
        await tx.financialConnection.upsert({
          where: { id: connection.id },
          update: {
            provider: connection.provider,
            displayName: connection.displayName,
            status: connection.status,
            lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt ? new Date(connection.lastSuccessfulSyncAt) : null
          },
          create: {
            id: connection.id,
            userId,
            provider: connection.provider,
            displayName: connection.displayName,
            status: connection.status,
            lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt ? new Date(connection.lastSuccessfulSyncAt) : null
          }
        });
      }

      for (const credential of payload.data.credentials) {
        await tx.encryptedCredential.upsert({
          where: { id: credential.id },
          update: {
            connectionId: credential.connectionId,
            credentialsIv: credential.credentialsIv,
            credentialsTag: credential.credentialsTag,
            credentialsCiphertext: credential.credentialsCiphertext,
            sessionIv: credential.sessionIv,
            sessionTag: credential.sessionTag,
            sessionCiphertext: credential.sessionCiphertext,
            algorithm: credential.algorithm,
            keyVersion: credential.keyVersion
          },
          create: {
            id: credential.id,
            connectionId: credential.connectionId,
            credentialsIv: credential.credentialsIv,
            credentialsTag: credential.credentialsTag,
            credentialsCiphertext: credential.credentialsCiphertext,
            sessionIv: credential.sessionIv,
            sessionTag: credential.sessionTag,
            sessionCiphertext: credential.sessionCiphertext,
            algorithm: credential.algorithm,
            keyVersion: credential.keyVersion
          }
        });
      }

      for (const account of payload.data.accounts) {
        await tx.bankAccount.upsert({
          where: { id: account.id },
          update: {
            name: account.name,
            accountType: account.accountType,
            currency: account.currency,
            lastBalance: account.lastBalance,
            lastBalanceAt: account.lastBalanceAt ? new Date(account.lastBalanceAt) : null
          },
          create: {
            id: account.id,
            userId,
            connectionId: account.connectionId,
            sourceExternalId: account.sourceExternalId,
            name: account.name,
            accountType: account.accountType,
            currency: account.currency,
            lastBalance: account.lastBalance,
            lastBalanceAt: account.lastBalanceAt ? new Date(account.lastBalanceAt) : null
          }
        });
      }

      for (const rule of payload.data.merchantRules) {
        await tx.merchantRule.upsert({
          where: { id: rule.id },
          update: {
            merchantNormalized: rule.merchantNormalized,
            categoryId: rule.categoryId
          },
          create: {
            id: rule.id,
            userId,
            merchantNormalized: rule.merchantNormalized,
            categoryId: rule.categoryId
          }
        });
      }

      for (const profile of payload.data.fixedExpenseProfiles) {
        await tx.fixedExpenseProfile.upsert({
          where: { id: profile.id },
          update: {
            merchantNormalized: profile.merchantNormalized,
            categoryId: profile.categoryId,
            avgMonthlyAmount: profile.avgMonthlyAmount,
            latestAmount: profile.latestAmount,
            stdDevAmount: profile.stdDevAmount,
            lastObservedAt: new Date(profile.lastObservedAt),
            isConfirmed: profile.isConfirmed,
            isIgnored: profile.isIgnored
          },
          create: {
            id: profile.id,
            userId,
            merchantNormalized: profile.merchantNormalized,
            categoryId: profile.categoryId,
            avgMonthlyAmount: profile.avgMonthlyAmount,
            latestAmount: profile.latestAmount,
            stdDevAmount: profile.stdDevAmount,
            lastObservedAt: new Date(profile.lastObservedAt),
            isConfirmed: profile.isConfirmed,
            isIgnored: profile.isIgnored
          }
        });
      }

      for (const budget of payload.data.monthlyBudgets) {
        await tx.monthlyBudget.upsert({
          where: { id: budget.id },
          update: {
            month: budget.month,
            capAmount: budget.capAmount
          },
          create: {
            id: budget.id,
            userId,
            month: budget.month,
            capAmount: budget.capAmount
          }
        });
      }

      for (const alert of payload.data.alertEvents) {
        await tx.alertEvent.upsert({
          where: { id: alert.id },
          update: {
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            metadata: alert.metadata,
            resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null
          },
          create: {
            id: alert.id,
            userId,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            metadata: alert.metadata,
            createdAt: new Date(alert.createdAt),
            resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null
          }
        });
      }

      for (const txRow of payload.data.transactions) {
        await tx.transaction.upsert({
          where: { id: txRow.id },
          update: {
            bankAccountId: txRow.bankAccountId,
            sourceExternalId: txRow.sourceExternalId,
            occurredAt: new Date(txRow.occurredAt),
            postedAt: txRow.postedAt ? new Date(txRow.postedAt) : null,
            merchant: txRow.merchant,
            merchantNormalized: txRow.merchantNormalized,
            description: txRow.description,
            amount: txRow.amount,
            direction: txRow.direction,
            categoryId: txRow.categoryId,
            sourceCategory: txRow.sourceCategory,
            isOutlier: txRow.isOutlier
          },
          create: {
            id: txRow.id,
            userId,
            bankAccountId: txRow.bankAccountId,
            sourceExternalId: txRow.sourceExternalId,
            occurredAt: new Date(txRow.occurredAt),
            postedAt: txRow.postedAt ? new Date(txRow.postedAt) : null,
            merchant: txRow.merchant,
            merchantNormalized: txRow.merchantNormalized,
            description: txRow.description,
            amount: txRow.amount,
            direction: txRow.direction,
            categoryId: txRow.categoryId,
            sourceCategory: txRow.sourceCategory,
            isOutlier: txRow.isOutlier
          }
        });
      }
    });

    return NextResponse.json({ ok: true, importedVersion: payload.version });
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "PASSCODE_REQUIRED"].includes(error.message)) {
      return unauthorized();
    }
    if (error instanceof z.ZodError) {
      return badRequest("Invalid backup payload");
    }
    return serverError(error instanceof Error ? error.message : "Import failed");
  }
}
