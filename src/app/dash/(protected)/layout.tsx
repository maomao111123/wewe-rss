import { DashboardNav } from "@/components/dashboard/nav";
import { appVersion } from "@/lib/app-info";
import { resolveServerOriginUrl } from "@/lib/config";
import { requireDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProtectedDashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardSession();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <DashboardNav
        appVersion={appVersion}
        serverOriginUrl={resolveServerOriginUrl()}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
