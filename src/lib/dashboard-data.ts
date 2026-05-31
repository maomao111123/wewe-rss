import { prisma } from '@/lib/prisma';
import { getBlockedAccountIds } from '@/lib/services/platform-service';
import { getDashboardTasks } from '@/lib/dashboard-tasks';
import { getDashboardArticlesPage } from '@/lib/dashboard-articles';
import { STATUS } from '@/lib/constants';

export async function getFeedsDashboardData(selectedFeedId?: string) {
  const feeds = await prisma.feed.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const selectedFeed = selectedFeedId
    ? feeds.find((item) => item.id === selectedFeedId) || null
    : null;

  const articlePage = await getDashboardArticlesPage({
    mpId: selectedFeedId,
    limit: 20,
  });

  const enabledAccountsCount = await prisma.account.count({
    where: { status: STATUS.ENABLE },
  });
  const articleCount = await prisma.article.count({
    where: selectedFeedId ? { mpId: selectedFeedId } : undefined,
  });

  return {
    feeds,
    selectedFeed,
    initialArticles: articlePage.items,
    initialNextCursor: articlePage.nextCursor,
    initialTasks: getDashboardTasks(),
    hasAvailableAccount: enabledAccountsCount > 0,
    articleCount,
  };
}

export async function getAccountsDashboardData() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return {
    accounts,
    blockedIds: getBlockedAccountIds(),
  };
}
