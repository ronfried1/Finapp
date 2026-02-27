import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/page-guard";
import { disablePasscodeAction, setPasscodeAction, verifyPasscodeAction } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { Card } from "@/components/card";

type Props = {
  searchParams: Promise<{ locked?: string }>;
};

export default async function SecurityPage({ searchParams }: Props) {
  const { userId, isUnlocked } = await requirePageUser({ allowLocked: true });
  const query = await searchParams;

  const passcode = await prisma.appPasscode.findUnique({ where: { userId } });
  const isEnabled = !!passcode?.enabled;
  const needsUnlock = query.locked === "1" && !isUnlocked;

  return (
    <AppShell title="Security" subtitle="Optional app passcode layered on top of Google OAuth.">
      {needsUnlock ? (
        <Card title="Unlock required" subtitle="Passcode is enabled for this account">
          <form action={verifyPasscodeAction} className="inline">
            <input name="passcode" type="password" placeholder="Enter passcode" pattern="[0-9]{4,8}" required />
            <button className="button" type="submit">
              Unlock dashboard
            </button>
          </form>
        </Card>
      ) : null}

      <section className="grid cols-2" style={{ marginTop: "0.9rem" }}>
        <Card title="Set / rotate passcode" subtitle="4-8 digit app-level lock">
          <form action={setPasscodeAction} className="inline">
            <input name="passcode" type="password" placeholder="New passcode" pattern="[0-9]{4,8}" required />
            <button className="button" type="submit">
              {isEnabled ? "Rotate" : "Enable"}
            </button>
          </form>
        </Card>

        <Card title="Disable passcode" subtitle="Remove additional lock layer">
          <form action={disablePasscodeAction}>
            <button className="button ghost" type="submit" disabled={!isEnabled}>
              Disable passcode
            </button>
          </form>
          <p className="muted">State: {isEnabled ? "Enabled" : "Disabled"}</p>
        </Card>
      </section>
    </AppShell>
  );
}
