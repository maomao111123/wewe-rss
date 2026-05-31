import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import { prisma } from '@/lib/prisma';
import { getEnv } from '@/lib/config';
import { STATUS } from '@/lib/constants';
import { dashboardState } from '@/lib/dashboard-state';
import {
  isDashboardTaskCancelled,
  setDashboardTaskProgress,
} from '@/lib/dashboard-tasks';
import { analyzeArticlePage } from '@/lib/services/article-analysis';
import { sleep } from '@/lib/time';

dayjs.extend(utc);
dayjs.extend(timezone);

type PlatformArticle = {
  id: string;
  title: string;
  picUrl: string;
  publishTime: number;
};

type PlatformMpInfo = {
  id: string;
  cover: string;
  name: string;
  intro: string;
  updateTime: number;
}[];

type LoginUrlPayload = {
  uuid: string;
  scanUrl: string;
};

type LoginResultPayload = {
  message: string;
  vid?: number;
  token?: string;
  username?: string;
};

const EMPTY_FIRST_PAGE_RETRY_DELAY_MS = 1_000;
const FULL_FETCH_EMPTY_PAGE_STREAK_LIMIT = 100;
const PLATFORM_THROTTLE_RETRY_DELAY_MS = 60_000;

class PlatformError extends Error {
  constructor(
    message: string,
    readonly accountId?: string,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

function getTodayDate() {
  return dayjs.tz(new Date(), 'Asia/Shanghai').format('YYYY-MM-DD');
}

export function getBlockedAccountIds() {
  return dashboardState.blockedAccountsMap.get(getTodayDate()) || [];
}

export function getArticleSourceUrl(id: string) {
  return `https://mp.weixin.qq.com/s/${id}`;
}

function addBlockedAccount(accountId: string) {
  const today = getTodayDate();
  const current = dashboardState.blockedAccountsMap.get(today) || [];
  dashboardState.blockedAccountsMap.set(today, [...current, accountId]);
}

export function removeBlockedAccount(accountId: string) {
  const today = getTodayDate();
  const current = dashboardState.blockedAccountsMap.get(today) || [];
  dashboardState.blockedAccountsMap.set(
    today,
    current.filter((id) => id !== accountId),
  );
}

async function getAvailableAccount() {
  const disabledAccounts = getBlockedAccountIds();
  const accounts = await prisma.account.findMany({
    where: {
      status: STATUS.ENABLE,
      NOT: {
        id: {
          in: disabledAccounts,
        },
      },
    },
    take: 10,
  });

  if (!accounts.length) {
    throw new Error('暂无可用读书账号!');
  }

  return accounts[Math.floor(Math.random() * accounts.length)];
}

async function fetchPlatformJson<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: unknown;
    searchParams?: Record<string, string | number | undefined>;
    headers?: HeadersInit;
    timeoutMs?: number;
  },
) {
  const env = getEnv();
  const url = new URL(path, env.PLATFORM_URL);

  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options?.timeoutMs ?? 15_000),
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage =
      payload?.message ||
      payload?.error ||
      text ||
      `Platform request failed: ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

function isAuthExpiredPlatformError(message: string) {
  return message.includes('WeReadError401');
}

function isTemporaryBlockedPlatformError(message: string) {
  return message.includes('WeReadError400');
}

function isThrottledPlatformError(message: string) {
  return (
    message.includes('ThrottlerException') ||
    message.includes('Too Many Requests')
  );
}

function getReadablePlatformErrorMessage(message: string) {
  if (isAuthExpiredPlatformError(message)) {
    return '微信读书账号授权已失效，请重新授权';
  }

  if (isTemporaryBlockedPlatformError(message)) {
    return '微信读书接口临时拒绝该账号，通常是请求过快触发风控，请稍后再试或换账号';
  }

  if (isThrottledPlatformError(message)) {
    return '上游接口限流，请稍后重试';
  }

  return message;
}

async function handlePlatformAccountError(error: PlatformError) {
  if (isThrottledPlatformError(error.message)) {
    await sleep(PLATFORM_THROTTLE_RETRY_DELAY_MS);
    return 'retryable' as const;
  }

  if (!error.accountId) {
    return 'failed' as const;
  }

  if (isAuthExpiredPlatformError(error.message)) {
    await prisma.account.update({
      where: { id: error.accountId },
      data: { status: STATUS.INVALID },
    });
    return 'auth-expired' as const;
  }

  if (isTemporaryBlockedPlatformError(error.message)) {
    addBlockedAccount(error.accountId);
    return 'account-blocked' as const;
  }

  if (error.message.includes('WeReadError429')) {
    addBlockedAccount(error.accountId);
    return 'retryable' as const;
  }

  return 'failed' as const;
}

export async function getMpArticles(
  mpId: string,
  page = 1,
  retryCount = 3,
): Promise<PlatformArticle[]> {
  const account = await getAvailableAccount();
  const requestArticles = (targetPage: number) =>
    fetchPlatformJson<PlatformArticle[]>(
      `/api/v2/platform/mps/${mpId}/articles`,
      {
        headers: {
          xid: account.id,
          Authorization: `Bearer ${account.token}`,
        },
        searchParams: {
          page: targetPage,
        },
      },
    );

  try {
    const articles = await requestArticles(page);

    if (page === 1 && articles.length === 0) {
      if (retryCount > 0) {
        await sleep(EMPTY_FIRST_PAGE_RETRY_DELAY_MS);
        return getMpArticles(mpId, page, retryCount - 1);
      }

      for (const fallbackPage of [2, 3]) {
        const fallbackArticles = await requestArticles(fallbackPage).catch(
          () => [],
        );
        if (fallbackArticles.length > 0) {
          return fallbackArticles;
        }
      }

      throw new Error('上游返回空文章列表，暂不判定为无文章');
    }

    return articles;
  } catch (error) {
    const platformError = new PlatformError(
      error instanceof Error ? error.message : '读取公众号文章失败',
      account.id,
    );

    const errorResult = await handlePlatformAccountError(platformError);

    if (errorResult === 'auth-expired' || errorResult === 'account-blocked') {
      throw new PlatformError(
        getReadablePlatformErrorMessage(platformError.message),
        account.id,
      );
    }

    if (retryCount > 0) {
      return getMpArticles(mpId, page, retryCount - 1);
    }

    throw new PlatformError(
      getReadablePlatformErrorMessage(platformError.message),
      account.id,
    );
  }
}

export async function getMpInfo(url: string) {
  const account = await getAvailableAccount();

  try {
    return await fetchPlatformJson<PlatformMpInfo>(`/api/v2/platform/wxs2mp`, {
      method: 'POST',
      body: { url: url.trim() },
      headers: {
        xid: account.id,
        Authorization: `Bearer ${account.token}`,
      },
    });
  } catch (error) {
    const platformError = new PlatformError(
      error instanceof Error ? error.message : '解析公众号失败',
      account.id,
    );

    await handlePlatformAccountError(platformError);
    throw new PlatformError(
      getReadablePlatformErrorMessage(platformError.message),
      account.id,
    );
  }
}

export function createLoginUrl() {
  return fetchPlatformJson<LoginUrlPayload>('/api/v2/login/platform');
}

export function getLoginResult(id: string) {
  return fetchPlatformJson<LoginResultPayload>(`/api/v2/login/platform/${id}`, {
    timeoutMs: 120_000,
  });
}

export async function refreshMpArticlesAndUpdateFeed(mpId: string, page = 1) {
  const articles = await getMpArticles(mpId, page);

  if (articles.length > 0) {
    await prisma.$transaction(
      articles.map(({ id, picUrl, publishTime, title }) =>
        prisma.article.upsert({
          where: { id },
          create: {
            id,
            mpId,
            picUrl,
            publishTime,
            title,
            sourceUrl: getArticleSourceUrl(id),
          },
          update: {
            picUrl,
            publishTime,
            title,
            sourceUrl: getArticleSourceUrl(id),
          },
        }),
      ),
    );
  }

  const hasHistory = articles.length > 0 ? 1 : 0;

  await prisma.feed.update({
    where: { id: mpId },
    data: {
      syncTime: Math.floor(Date.now() / 1_000),
      hasHistory,
    },
  });

  return {
    hasHistory,
    articleIds: articles.map((article) => article.id),
  };
}

export async function refreshAllMpArticlesAndUpdateFeed(options?: {
  taskId?: string;
}) {
  const feeds = await prisma.feed.findMany({
    where: {
      status: STATUS.ENABLE,
    },
  });

  for (const [index, feed] of feeds.entries()) {
    if (options?.taskId && isDashboardTaskCancelled(options.taskId)) {
      return;
    }

    if (options?.taskId) {
      setDashboardTaskProgress(options.taskId, {
        current: index + 1,
        total: feeds.length,
        label: `更新 ${feed.mpName}`,
      });
    }

    await fetchAllMpArticlesAndUpdateFeed(feed.id, options);
    await sleep(getEnv().UPDATE_DELAY_TIME * 1_000);
  }
}

export async function getHistoryMpArticles(
  mpId: string,
  options?: {
    taskId?: string;
    startPage?: number;
  },
) {
  if (!mpId) {
    return;
  }

  let currentPage = Math.max(2, options?.startPage ?? 2);
  let remaining = 1_000;
  const seenPageSignatures = new Set<string>();
  let duplicatePageCount = 0;
  let emptyPageCount = 0;
  let fetchedCount = 0;

  while (remaining-- > 0) {
    if (options?.taskId && isDashboardTaskCancelled(options.taskId)) {
      return;
    }

    if (options?.taskId) {
      setDashboardTaskProgress(options.taskId, {
        current: currentPage,
        label: `抓取第 ${currentPage} 页`,
        fetchedCount,
      });
    }

    const { articleIds } = await refreshMpArticlesAndUpdateFeed(
      mpId,
      currentPage,
    );
    fetchedCount += articleIds.length;

    if (options?.taskId) {
      setDashboardTaskProgress(options.taskId, {
        current: currentPage,
        label: `抓取第 ${currentPage} 页`,
        fetchedCount,
      });
    }

    if (articleIds.length === 0) {
      emptyPageCount += 1;
      if (emptyPageCount >= FULL_FETCH_EMPTY_PAGE_STREAK_LIMIT) {
        return;
      }
      currentPage += 1;
      await sleep(getEnv().UPDATE_DELAY_TIME * 1_000);
      continue;
    }

    emptyPageCount = 0;
    const pageSignature = articleIds.join('|');
    if (seenPageSignatures.has(pageSignature)) {
      duplicatePageCount += 1;
      if (duplicatePageCount >= 3) {
        return;
      }
    } else {
      seenPageSignatures.add(pageSignature);
      duplicatePageCount = 0;
    }

    currentPage += 1;
    await sleep(getEnv().UPDATE_DELAY_TIME * 1_000);
  }
}

export async function fetchAllMpArticlesAndUpdateFeed(
  mpId: string,
  options?: {
    taskId?: string;
    startPage?: number;
  },
) {
  let currentPage = Math.max(1, options?.startPage ?? 1);
  let remaining = 1_000;
  const seenPageSignatures = new Set<string>();
  let duplicatePageCount = 0;
  let emptyPageCount = 0;
  let fetchedCount = 0;

  while (remaining-- > 0) {
    if (options?.taskId && isDashboardTaskCancelled(options.taskId)) {
      return;
    }

    if (options?.taskId) {
      setDashboardTaskProgress(options.taskId, {
        current: currentPage,
        label: `抓取第 ${currentPage} 页`,
        fetchedCount,
      });
    }

    const { articleIds } = await refreshMpArticlesAndUpdateFeed(
      mpId,
      currentPage,
    );
    fetchedCount += articleIds.length;

    if (options?.taskId) {
      setDashboardTaskProgress(options.taskId, {
        current: currentPage,
        label: `抓取第 ${currentPage} 页`,
        fetchedCount,
      });
    }

    if (articleIds.length === 0) {
      emptyPageCount += 1;
      if (emptyPageCount >= FULL_FETCH_EMPTY_PAGE_STREAK_LIMIT) {
        return;
      }
      currentPage += 1;
      await sleep(getEnv().UPDATE_DELAY_TIME * 1_000);
      continue;
    }

    emptyPageCount = 0;
    const pageSignature = articleIds.join('|');
    if (seenPageSignatures.has(pageSignature)) {
      duplicatePageCount += 1;
      if (duplicatePageCount >= 3) {
        return;
      }
    } else {
      seenPageSignatures.add(pageSignature);
      duplicatePageCount = 0;
    }

    currentPage += 1;
    await sleep(getEnv().UPDATE_DELAY_TIME * 1_000);
  }
}

export async function analyzeFeedArticles(
  mpId: string,
  options?: {
    taskId?: string;
  },
) {
  const articles = await prisma.article.findMany({
    where: {
      mpId,
      OR: [{ contentType: 'unknown' }, { textLength: 0 }, { sourceUrl: null }],
    },
    orderBy: [{ publishTime: 'desc' }, { id: 'desc' }],
  });

  for (const [index, article] of articles.entries()) {
    if (options?.taskId && isDashboardTaskCancelled(options.taskId)) {
      return;
    }

    if (options?.taskId) {
      setDashboardTaskProgress(options.taskId, {
        current: index + 1,
        total: articles.length,
        label: article.title,
      });
    }

    try {
      const sourceUrl = article.sourceUrl || getArticleSourceUrl(article.id);
      const analysis = await analyzeArticlePage(sourceUrl);

      await prisma.article.update({
        where: { id: article.id },
        data: {
          sourceUrl,
          contentType: analysis.contentType,
          textLength: analysis.textLength,
        },
      });
    } catch {
      await prisma.article.update({
        where: { id: article.id },
        data: {
          sourceUrl: article.sourceUrl || getArticleSourceUrl(article.id),
          contentType: 'unknown',
          textLength: 0,
        },
      });
    }
  }
}
