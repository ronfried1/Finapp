import { ReactNode } from "react";
import { TopNav } from "@/components/nav";

export function AppShell(props: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="app">
      <TopNav />
      <section className="page-title">
        <h1>{props.title}</h1>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
      </section>
      {props.children}
    </main>
  );
}
