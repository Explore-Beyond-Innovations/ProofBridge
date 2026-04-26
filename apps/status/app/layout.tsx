import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofBridge Uptime",
  description:
    "ProofBridge uptime and reconciliation status — currently under development.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
