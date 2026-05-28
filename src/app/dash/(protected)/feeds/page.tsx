import { FeedsDashboard } from "@/components/dashboard/feeds-dashboard";
import { resolveServerOriginUrl } from "@/lib/config";
import { getFeedsDashboardData } from "@/lib/dashboard-data";

export default async function FeedsPage() {
  const data = await getFeedsDashboardData();

  return (
    <FeedsDashboard
      feeds={data.feeds}
      selectedFeed={data.selectedFeed}
      initialArticles={data.initialArticles}
      initialNextCursor={data.initialNextCursor}
      initialHistoryProgress={data.historyProgress}
      initialIsRefreshingAll={data.isRefreshAllMpArticlesRunning}
      serverOriginUrl={resolveServerOriginUrl()}
    />
  );
}
