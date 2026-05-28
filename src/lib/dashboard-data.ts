import { prisma } from "@/lib/prisma";
import { getBlockedAccountIds } from "@/lib/services/platform-service";
import { getHistoryProgress, dashboardState } from "@/lib/dashboard-state";
import { getDashboardArticlesPage } from "@/lib/dashboard-articles";

export async function getFeedsDashboardData(selectedFeedId?: string) {
  const feeds = await prisma.feed.findMany({
    orderBy: { createdAt: "asc" },
  });

  const selectedFeed = selectedFeedId
    ? feeds.find((item) => item.id === selectedFeedId) || null
    : null;

  const articlePage = await getDashboardArticlesPage({
    mpId: selectedFeedId,
    limit: 20,
  });

  return {
    feeds,
    selectedFeed,
    initialArticles: articlePage.items,
    initialNextCursor: articlePage.nextCursor,
    historyProgress: getHistoryProgress(),
    isRefreshAllMpArticlesRunning: dashboardState.isRefreshAllMpArticlesRunning,
  };
}

export async function getAccountsDashboardData() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
  });

  return {
    accounts,
    blockedIds: getBlockedAccountIds(),
  };
}
