import { redirect } from "next/navigation";

import { LoginForm } from "@/components/dashboard/login-form";
import { Card } from "@/components/ui/card";
import { isAuthEnabled } from "@/lib/config";
import { getDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isAuthEnabled() || (await getDashboardSession())) {
    redirect("/dash/feeds");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md border-slate-200 p-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            WeWe RSS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            输入 AUTH_CODE 后进入 /dash 管理后台。
          </p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}
