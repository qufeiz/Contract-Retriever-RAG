import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Business Knowledge Assistant",
  description:
    "Ask a business question — routed to the right source(s), answered with hybrid SQL + RAG retrieval and inline citations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
