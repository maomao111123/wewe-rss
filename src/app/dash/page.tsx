import { redirect } from "next/navigation";

import { getDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashIndexPage() {
  if (await getDashboardSession()) {
    redirect("/dash/feeds");
  }

  redirect("/dash/login");
}
