import { ReactNode } from "react";

export function Card(props: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card">
      <header>
        <h3>{props.title}</h3>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
      </header>
      <div>{props.children}</div>
    </section>
  );
}
