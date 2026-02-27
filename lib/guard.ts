import { ensurePasscodeIfEnabled } from "@/lib/authz";
import { requireUserId } from "@/lib/auth";

export async function requireApiAccess() {
  const userId = await requireUserId();
  const ok = await ensurePasscodeIfEnabled(userId);
  if (!ok) {
    throw new Error("PASSCODE_REQUIRED");
  }
  return userId;
}
