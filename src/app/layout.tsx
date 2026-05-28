import type { Metadata } from "next";

import { AppProviders } from "@/components/providers/app-providers";
import { appVersion } from "@/lib/app-info";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "WeWe RSS",
  description: `WeWe RSS Dashboard v${appVersion}`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
