import { randomUUID } from "crypto";

export type ScraperCredentials = {
  username: string;
  password: string;
  otpCode?: string;
  institution: string;
};

export type ScrapedAccount = {
  externalId: string;
  name: string;
  type: "bank" | "credit";
  balance: number;
  balanceAt: string;
};

export type ScrapedTransaction = {
  accountExternalId: string;
  externalId: string;
  occurredAt: string;
  postedAt?: string;
  merchant: string;
  description: string;
  amount: number;
  sourceCategory?: string;
};

export type ScrapeSuccess = {
  kind: "success";
  accounts: ScrapedAccount[];
  transactions: ScrapedTransaction[];
  sessionBlob?: unknown;
};

export type ScrapeChallenge = {
  kind: "challenge";
  challengeType: "otp";
  challengeMessage: string;
  sessionBlob?: unknown;
};

export type ScrapeFailure = {
  kind: "failure";
  message: string;
};

export type ScrapeResult = ScrapeSuccess | ScrapeChallenge | ScrapeFailure;

function mockTransactions(accountExternalId: string): ScrapedTransaction[] {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const [year, monthValue] = month.split("-").map(Number);
  const items = [
    ["Shufersal", "Groceries", -840],
    ["Wolt", "Dining", -410],
    ["Electric Co", "Utilities", -510],
    ["Cellcom", "Utilities", -210],
    ["Salary", "Salary", 18400],
    ["Super-Pharm", "Health", -190],
    ["AM:PM", "Groceries", -130],
    ["Rent", "Housing", -6200]
  ] as const;

  return items.map(([merchant, sourceCategory, amount], index) => ({
    accountExternalId,
    externalId: `${accountExternalId}-${month}-${index}`,
    occurredAt: new Date(Date.UTC(year, monthValue - 1, 3 + index)).toISOString(),
    postedAt: new Date(Date.UTC(year, monthValue - 1, 4 + index)).toISOString(),
    merchant,
    description: `${merchant} card transaction`,
    amount,
    sourceCategory
  }));
}

export async function scrapeAccountsAndTransactions(credentials: ScraperCredentials, sessionBlob?: unknown): Promise<ScrapeResult> {
  const useMock = process.env.USE_SCRAPER_MOCK !== "false";

  if (useMock) {
    if (!credentials.otpCode && credentials.institution.toLowerCase().includes("credit")) {
      return {
        kind: "challenge",
        challengeType: "otp",
        challengeMessage: "Enter one-time passcode sent by the institution",
        sessionBlob: { challengeId: randomUUID(), hint: "mock" }
      };
    }

    const accountExternalId = `acct-${credentials.institution.toLowerCase()}-main`;
    return {
      kind: "success",
      accounts: [
        {
          externalId: accountExternalId,
          name: `${credentials.institution} Main`,
          type: credentials.institution.toLowerCase().includes("credit") ? "credit" : "bank",
          balance: 42150,
          balanceAt: new Date().toISOString()
        }
      ],
      transactions: mockTransactions(accountExternalId),
      sessionBlob: { lastSyncAt: new Date().toISOString(), from: sessionBlob ?? null }
    };
  }

  // Production adapter hook for israeli-bank-scrapers.
  // This is intentionally isolated so it can be swapped for direct package integration.
  throw new Error("Live israeli-bank-scrapers adapter not configured. Set USE_SCRAPER_MOCK=true or implement adapter.");
}
