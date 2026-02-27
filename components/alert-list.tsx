import { resolveAlertAction } from "@/app/actions";

export function AlertList(props: {
  items: Array<{
    id: string;
    type: string;
    message: string;
    severity: string;
    createdAt: Date;
  }>;
}) {
  if (!props.items.length) {
    return <p className="empty">No open alerts.</p>;
  }

  return (
    <div className="alert-list">
      {props.items.map((alert) => (
        <div key={alert.id} className={`alert-item ${alert.severity}`}>
          <div>
            <p className="alert-title">{alert.type.replaceAll("_", " ")}</p>
            <p>{alert.message}</p>
            <p className="muted">{new Intl.DateTimeFormat("en-GB").format(alert.createdAt)}</p>
          </div>
          <form action={resolveAlertAction}>
            <input type="hidden" name="alertId" value={alert.id} />
            <button className="button ghost" type="submit">
              Resolve
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
