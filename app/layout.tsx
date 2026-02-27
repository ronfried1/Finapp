import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Clarity Dashboard",
  description: "Personal finance dashboard focused on cash clarity and spending behavior"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
