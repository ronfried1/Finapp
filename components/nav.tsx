import Link from "next/link";
import { signOut } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  ["Dashboard", "/dashboard"],
  ["Transactions", "/transactions"],
  ["Categories", "/categories"],
  ["Fixed", "/fixed-expenses"],
  ["Budget", "/budget"],
  ["Accounts", "/accounts"],
  ["Security", "/settings/security"]
] as const;

export function TopNav() {
  return (
    <header className="topnav">
      <div className="topnav-title">
        <span className="dot" />
        <span>Finance Clarity</span>
      </div>
      <nav className="topnav-links">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="nav-link">
            {label}
          </Link>
        ))}
      </nav>
      <div className="topnav-actions">
        <ThemeToggle />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button className="button" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
