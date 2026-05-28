import { AccountsDashboard } from "@/components/dashboard/accounts-dashboard";
import { getAccountsDashboardData } from "@/lib/dashboard-data";

export default async function AccountsPage() {
  const data = await getAccountsDashboardData();

  return (
    <AccountsDashboard accounts={data.accounts} blockedIds={data.blockedIds} />
  );
}
