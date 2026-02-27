import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/page-guard";
import { createConnectionAction, submitChallengeAction, syncConnectionAction } from "@/app/actions";
import { AppShell } from "@/components/shell";
import { Card } from "@/components/card";

export default async function AccountsPage() {
  const { userId } = await requirePageUser();

  const [connections, openChallenges] = await Promise.all([
    prisma.financialConnection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.syncChallenge.findMany({
      where: {
        status: "OPEN",
        syncJob: {
          connection: { userId }
        }
      },
      include: {
        syncJob: {
          include: {
            connection: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    })
  ]);

  return (
    <AppShell title="Accounts & Sync" subtitle="Connect institutions, run manual sync, and resolve OTP challenges.">
      <section className="grid cols-2">
        <Card title="Add connection" subtitle="Credentials are encrypted before storage">
          <form action={createConnectionAction} className="inline">
            <input name="displayName" placeholder="Display name" required />
            <input name="institution" placeholder="Institution (e.g. Hapoalim Credit)" required />
            <input name="username" placeholder="Username" required />
            <input name="password" type="password" placeholder="Password" required />
            <input type="hidden" name="provider" value="israeli-bank-scrapers" />
            <button className="button" type="submit">
              Save connection
            </button>
          </form>
        </Card>

        <Card title="Open OTP challenges" subtitle="Submit one-time code and continue blocked sync">
          {openChallenges.length === 0 ? (
            <p className="empty">No open challenges.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Connection</th>
                    <th>Challenge</th>
                    <th>OTP</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {openChallenges.map((challenge) => (
                    <tr key={challenge.id}>
                      <td>{challenge.syncJob.connection.displayName}</td>
                      <td>{challenge.challengeType}</td>
                      <td>
                        <form action={submitChallengeAction} className="inline">
                          <input type="hidden" name="challengeId" value={challenge.id} />
                          <input name="otpCode" placeholder="123456" required />
                          <button className="button ghost" type="submit">
                            Submit OTP
                          </button>
                        </form>
                      </td>
                      <td>{challenge.expiresAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section className="card" style={{ marginTop: "0.9rem" }}>
        <h3>Connections</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Last Sync</th>
                <th>Last Job</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((connection) => (
                <tr key={connection.id}>
                  <td>{connection.displayName}</td>
                  <td>{connection.provider}</td>
                  <td>{connection.status}</td>
                  <td>{connection.lastSuccessfulSyncAt ? connection.lastSuccessfulSyncAt.toISOString().slice(0, 16).replace("T", " ") : "-"}</td>
                  <td>{connection.syncJobs[0]?.status ?? "-"}</td>
                  <td>
                    <form action={syncConnectionAction}>
                      <input type="hidden" name="connectionId" value={connection.id} />
                      <button className="button ghost" type="submit">
                        Sync now
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
