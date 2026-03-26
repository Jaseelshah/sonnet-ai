import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthShell } from "@/components/AuthShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sonnet AI - SOC Dashboard",
  description: "Autonomous SOC triage agent dashboard powered by Sonnet AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
