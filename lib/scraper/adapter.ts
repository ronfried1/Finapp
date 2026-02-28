import { randomUUID } from "crypto";
import { CompanyTypes, createScraper } from "israeli-bank-scrapers";

export type ScraperCredentials = {
  username: string;
  password: string;
  otpCode?: string;
  institution: string;
  accountNumber?: string;
  card6Digits?: string;
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

type ResolvedInstitution = {
  companyId: string;
  kind: "bank" | "credit";
  displayName: string;
};

const institutionAliases: Array<{ companyId: string; aliases: string[]; kind: "bank" | "credit"; displayName: string }> = [
  { companyId: "discount", aliases: ["discount", "discount bank", "דיסקונט"], kind: "bank", displayName: "Discount" },
  { companyId: "max", aliases: ["max"], kind: "credit", displayName: "Max" },
  { companyId: "visaCal", aliases: ["cal", "visa cal", "כאל"], kind: "credit", displayName: "Cal" },
  {
    companyId: "isracard",
    aliases: ["isracard", "isra card", "isracart", "ישראכרט"],
    kind: "credit",
    displayName: "Isracard"
  }
];

function normalizeInstitution(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveInstitution(institution: string): ResolvedInstitution {
  const normalized = normalizeInstitution(institution);
  const match = institutionAliases.find((item) => item.aliases.includes(normalized) || item.companyId.toLowerCase() === normalized);
  if (!match) {
    throw new Error(`Unsupported institution "${institution}". Supported: Discount, Max, Cal, Isracard.`);
  }

  return {
    companyId: match.companyId,
    kind: match.kind,
    displayName: match.displayName
  };
}

function toCompanyType(companyId: string) {
  const map: Record<string, string> = {
    discount: CompanyTypes.discount,
    max: CompanyTypes.max,
    visaCal: CompanyTypes.visaCal,
    isracard: CompanyTypes.isracard
  };

  const value = map[companyId];
  if (!value) {
    throw new Error(`Unsupported company type mapping for ${companyId}`);
  }

  return value;
}

function getStartDate(): Date {
  const days = Number(process.env.SCRAPER_START_DAYS ?? "365");
  const safeDays = Number.isFinite(days) && days > 0 ? days : 365;
  return new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
}

function parseAmount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildCredentialsForInstitution(resolved: ResolvedInstitution, credentials: ScraperCredentials) {
  switch (resolved.companyId) {
    case "discount":
      if (!credentials.accountNumber) {
        throw new Error("Discount requires accountNumber (num).");
      }
      return {
        id: credentials.username,
        password: credentials.password,
        num: credentials.accountNumber
      };
    case "max":
    case "visaCal":
      return {
        username: credentials.username,
        password: credentials.password
      };
    case "isracard":
      if (!credentials.card6Digits) {
        throw new Error("Isracard requires card6Digits (last 6 card digits).");
      }
      return {
        id: credentials.username,
        password: credentials.password,
        card6Digits: credentials.card6Digits
      };
    default:
      throw new Error(`Unsupported institution company id: ${resolved.companyId}`);
  }
}

function serializeLiveResults(input: {
  companyId: string;
  kind: "bank" | "credit";
  displayName: string;
  scrapeResult: {
    accounts?: Array<{
      accountNumber?: string | number;
      balance?: number;
      txns?: Array<{
        date?: string;
        processedDate?: string;
        originalAmount?: number;
        chargedAmount?: number;
        description?: string;
        identifier?: string | number;
      }>;
    }>;
  };
}): ScrapeSuccess {
  const nowIso = new Date().toISOString();
  const accounts = (input.scrapeResult.accounts ?? []).map((account, accountIndex) => {
    const accountNumber = String(account.accountNumber ?? `${accountIndex + 1}`);
    const externalId = `${input.companyId}:${accountNumber}`;
    return {
      externalId,
      name: `${input.displayName} ${accountNumber}`,
      type: input.kind,
      balance: parseAmount(account.balance),
      balanceAt: nowIso
    } satisfies ScrapedAccount;
  });

  const transactions: ScrapedTransaction[] = [];

  for (const [accountIndex, account] of (input.scrapeResult.accounts ?? []).entries()) {
    const accountNumber = String(account.accountNumber ?? `${accountIndex + 1}`);
    const accountExternalId = `${input.companyId}:${accountNumber}`;
    const txns = account.txns ?? [];

    txns.forEach((tx, txIndex) => {
      const occurredAt = tx.date ? new Date(tx.date).toISOString() : nowIso;
      const postedAt = tx.processedDate ? new Date(tx.processedDate).toISOString() : undefined;
      const amount = parseAmount(tx.chargedAmount ?? tx.originalAmount);
      const description = (tx.description ?? "").trim() || "Unknown transaction";
      const marker = tx.identifier ? String(tx.identifier) : `${occurredAt}:${amount}:${txIndex}`;

      transactions.push({
        accountExternalId,
        externalId: `${accountExternalId}:${marker}`,
        occurredAt,
        postedAt,
        merchant: description.slice(0, 120),
        description,
        amount
      });
    });
  }

  return {
    kind: "success",
    accounts,
    transactions
  };
}

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

  try {
    const resolved = resolveInstitution(credentials.institution);

    const scraper = createScraper({
      companyId: toCompanyType(resolved.companyId),
      startDate: getStartDate(),
      showBrowser: process.env.SCRAPER_SHOW_BROWSER === "true"
    });

    const scrapeCredentials = buildCredentialsForInstitution(resolved, credentials) as Record<string, unknown>;
    const scrapeResult = await scraper.scrape(scrapeCredentials);

    if (!scrapeResult.success) {
      const reason = [scrapeResult.errorType, scrapeResult.errorMessage].filter(Boolean).join(": ");
      return {
        kind: "failure",
        message: reason || "Scrape failed"
      };
    }

    const parsed = serializeLiveResults({
      companyId: resolved.companyId,
      kind: resolved.kind,
      displayName: resolved.displayName,
      scrapeResult
    });

    if (parsed.accounts.length === 0) {
      return {
        kind: "failure",
        message: "No accounts returned from scraper."
      };
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      return {
        kind: "failure",
        message: error.message
      };
    }

    return {
      kind: "failure",
      message: "Unknown scraper error"
    };
  }
}
