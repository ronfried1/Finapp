import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensurePasscodeIfEnabled } from "@/lib/authz";

export async function requirePageUser(options?: { allowLocked?: boolean }): Promise<{ userId: string; isUnlocked: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  const unlocked = await ensurePasscodeIfEnabled(userId);
  if (!unlocked && !options?.allowLocked) {
    redirect("/settings/security?locked=1");
  }

  return { userId, isUnlocked: unlocked };
}
