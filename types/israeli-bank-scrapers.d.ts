declare module "israeli-bank-scrapers" {
  export const CompanyTypes: Record<string, string>;

  export function createScraper(options: {
    companyId: string;
    startDate?: Date;
    showBrowser?: boolean;
    combineInstallments?: boolean;
    [key: string]: unknown;
  }): {
    scrape(credentials: Record<string, unknown>): Promise<{
      success: boolean;
      errorType?: string;
      errorMessage?: string;
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
    }>;
  };
}
