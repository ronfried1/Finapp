import { Direction, SyncJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeMerchant } from "@/lib/format";
import { currentMonthKey } from "@/lib/date";
import { logError, logInfo } from "@/lib/logger";
import { scrapeAccountsAndTransactions } from "@/lib/scraper/adapter";
import { getDecryptedCredentials, getSessionBlob, updateEncryptedSession } from "@/lib/services/connection-service";
import { pickCategoryId } from "@/lib/services/category-service";
import { recomputeFixedExpenseProfiles } from "@/lib/services/fixed-expense-service";
import { evaluateAlertsForMonth } from "@/lib/services/alert-service";

async function ingestSyncData(input: {
  userId: string;
  connectionId: string;
  accounts: Array<{ externalId: string; name: string; type: string; balance: number; balanceAt: string }>;
  transactions: Array<{
    accountExternalId: string;
    externalId: string;
    occurredAt: string;
    postedAt?: string;
    merchant: string;
    description: string;
    amount: number;
    sourceCategory?: string;
  }>;
}) {
  const accountIdByExternal = new Map<string, string>();

  for (const account of input.accounts) {
    const row = await prisma.bankAccount.upsert({
      where: {
        connectionId_sourceExternalId: {
          connectionId: input.connectionId,
          sourceExternalId: account.externalId
        }
      },
      create: {
        userId: input.userId,
        connectionId: input.connectionId,
        sourceExternalId: account.externalId,
        name: account.name,
        accountType: account.type,
        currency: "ILS",
        lastBalance: account.balance,
        lastBalanceAt: new Date(account.balanceAt)
      },
      update: {
        name: account.name,
        accountType: account.type,
        lastBalance: account.balance,
        lastBalanceAt: new Date(account.balanceAt)
      }
    });

    accountIdByExternal.set(account.externalId, row.id);
  }

  for (const tx of input.transactions) {
    const bankAccountId = accountIdByExternal.get(tx.accountExternalId);
    if (!bankAccountId) continue;

    const categoryId = await pickCategoryId(input.userId, tx.sourceCategory, tx.merchant);
    const direction = tx.amount >= 0 ? Direction.income : Direction.expense;

    await prisma.transaction.upsert({
      where: {
        bankAccountId_sourceExternalId: {
          bankAccountId,
          sourceExternalId: tx.externalId
        }
      },
      create: {
        userId: input.userId,
        bankAccountId,
        sourceExternalId: tx.externalId,
        occurredAt: new Date(tx.occurredAt),
        postedAt: tx.postedAt ? new Date(tx.postedAt) : null,
        merchant: tx.merchant,
        merchantNormalized: normalizeMerchant(tx.merchant),
        description: tx.description,
        amount: tx.amount,
        direction,
        categoryId,
        sourceCategory: tx.sourceCategory,
        isOutlier: false
      },
      update: {
        occurredAt: new Date(tx.occurredAt),
        postedAt: tx.postedAt ? new Date(tx.postedAt) : null,
        merchant: tx.merchant,
        merchantNormalized: normalizeMerchant(tx.merchant),
        description: tx.description,
        amount: tx.amount,
        direction,
        categoryId,
        sourceCategory: tx.sourceCategory
      }
    });
  }
}

async function markSyncFailed(syncJobId: string, error: unknown) {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: {
      status: SyncJobStatus.FAILED,
      finishedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : "Unknown sync error"
    }
  });
}

export async function startConnectionSync(userId: string, connectionId: string) {
  const connection = await prisma.financialConnection.findFirst({
    where: {
      id: connectionId,
      userId
    }
  });

  if (!connection) {
    throw new Error("Connection not found");
  }

  const syncJob = await prisma.syncJob.create({
    data: {
      connectionId,
      status: SyncJobStatus.RUNNING,
      startedAt: new Date()
    }
  });

  try {
    const credentials = await getDecryptedCredentials(connectionId);
    const sessionBlob = await getSessionBlob(connectionId);

    const result = await scrapeAccountsAndTransactions(
      {
        institution: credentials.institution,
        username: credentials.username,
        password: credentials.password
      },
      sessionBlob
    );

    if (result.kind === "challenge") {
      const challenge = await prisma.syncChallenge.create({
        data: {
          syncJobId: syncJob.id,
          challengeType: result.challengeType,
          status: "OPEN",
          payload: {
            connectionId,
            sessionBlob: result.sessionBlob
          },
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      });

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { status: SyncJobStatus.CHALLENGE_REQUIRED }
      });

      return {
        status: "challenge_required" as const,
        syncJobId: syncJob.id,
        challengeId: challenge.id,
        message: result.challengeMessage
      };
    }

    if (result.kind === "failure") {
      throw new Error(result.message);
    }

    await ingestSyncData({
      userId,
      connectionId,
      accounts: result.accounts,
      transactions: result.transactions
    });

    if (result.sessionBlob) {
      await updateEncryptedSession(connectionId, result.sessionBlob);
    }

    await recomputeFixedExpenseProfiles(userId);
    await evaluateAlertsForMonth(userId, currentMonthKey());

    await prisma.financialConnection.update({
      where: { id: connectionId },
      data: { lastSuccessfulSyncAt: new Date(), status: "ACTIVE" }
    });

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date()
      }
    });

    logInfo("Connection sync completed", { connectionId, syncJobId: syncJob.id });

    return {
      status: "completed" as const,
      syncJobId: syncJob.id
    };
  } catch (error) {
    logError("Connection sync failed", error, { connectionId, syncJobId: syncJob.id });
    await markSyncFailed(syncJob.id, error);
    throw error;
  }
}

export async function submitSyncChallenge(userId: string, challengeId: string, otpCode: string) {
  const challenge = await prisma.syncChallenge.findUnique({
    where: { id: challengeId },
    include: {
      syncJob: {
        include: {
          connection: true
        }
      }
    }
  });

  if (!challenge || challenge.syncJob.connection.userId !== userId) {
    throw new Error("Challenge not found");
  }

  if (challenge.status !== "OPEN" || challenge.expiresAt < new Date()) {
    throw new Error("Challenge expired");
  }

  const credentials = await getDecryptedCredentials(challenge.syncJob.connectionId);
  const payload = challenge.payload as { sessionBlob?: unknown } | null;

  const result = await scrapeAccountsAndTransactions(
    {
      institution: credentials.institution,
      username: credentials.username,
      password: credentials.password,
      otpCode
    },
    payload?.sessionBlob
  );

  if (result.kind === "challenge") {
    await prisma.syncChallenge.update({
      where: { id: challengeId },
      data: {
        attempts: { increment: 1 },
        payload: {
          connectionId: challenge.syncJob.connectionId,
          sessionBlob: result.sessionBlob
        }
      }
    });

    return {
      status: "challenge_required" as const,
      challengeId,
      message: result.challengeMessage
    };
  }

  if (result.kind === "failure") {
    await prisma.syncChallenge.update({
      where: { id: challengeId },
      data: {
        attempts: { increment: 1 }
      }
    });
    throw new Error(result.message);
  }

  await ingestSyncData({
    userId,
    connectionId: challenge.syncJob.connectionId,
    accounts: result.accounts,
    transactions: result.transactions
  });

  if (result.sessionBlob) {
    await updateEncryptedSession(challenge.syncJob.connectionId, result.sessionBlob);
  }

  await prisma.syncChallenge.update({
    where: { id: challengeId },
    data: { status: "RESOLVED" }
  });

  await prisma.syncJob.update({
    where: { id: challenge.syncJobId },
    data: {
      status: SyncJobStatus.COMPLETED,
      finishedAt: new Date()
    }
  });

  await prisma.financialConnection.update({
    where: { id: challenge.syncJob.connectionId },
    data: { lastSuccessfulSyncAt: new Date(), status: "ACTIVE" }
  });

  await recomputeFixedExpenseProfiles(userId);
  await evaluateAlertsForMonth(userId, currentMonthKey());

  return {
    status: "completed" as const,
    syncJobId: challenge.syncJobId
  };
}

export async function runDailySyncForUser(userId: string) {
  const connections = await prisma.financialConnection.findMany({
    where: {
      userId,
      status: "ACTIVE"
    }
  });

  for (const connection of connections) {
    try {
      await startConnectionSync(userId, connection.id);
    } catch (error) {
      logError("Daily sync error", error, { userId, connectionId: connection.id });
    }
  }

  return { syncedConnections: connections.length };
}

export async function runDailySyncAllUsers() {
  const users = await prisma.user.findMany({ select: { id: true } });
  let synced = 0;

  for (const user of users) {
    const result = await runDailySyncForUser(user.id);
    synced += result.syncedConnections;
  }

  return { users: users.length, syncedConnections: synced };
}
