import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rex", template: "%s | Rex" },
  description: "Associate management, client assignment and escalation tracking.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request so each one gets the CSP nonce from src/proxy.ts.
  await connection();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
