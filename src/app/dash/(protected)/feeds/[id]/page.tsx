import { notFound } from "next/navigation";

import { FeedsDashboard } from "@/components/dashboard/feeds-dashboard";
import { resolveServerOriginUrl } from "@/lib/config";
import { getFeedsDashboardData } from "@/lib/dashboard-data";

export default async function FeedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getFeedsDashboardData(id);

  if (!data.selectedFeed) {
    notFound();
  }

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
