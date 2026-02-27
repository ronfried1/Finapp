"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const next = saved ?? "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  }

  return (
    <button className="button ghost" type="button" onClick={toggle}>
      {theme === "light" ? "Dark" : "Light"} mode
    </button>
  );
}
