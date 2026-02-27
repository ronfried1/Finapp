import { prisma } from "@/lib/db";
import { isPasscodeVerified } from "@/lib/passcode";

export async function ensurePasscodeIfEnabled(userId: string): Promise<boolean> {
  const record = await prisma.appPasscode.findUnique({ where: { userId } });
  if (!record?.enabled) {
    return true;
  }
  return isPasscodeVerified(userId);
}
