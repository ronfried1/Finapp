export function Kpi(props: { label: string; value: string; hint?: string; tone?: "default" | "good" | "bad" }) {
  return (
    <article className={`kpi ${props.tone ?? "default"}`}>
      <p className="kpi-label">{props.label}</p>
      <p className="kpi-value">{props.value}</p>
      {props.hint ? <p className="kpi-hint">{props.hint}</p> : null}
    </article>
  );
}
