import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/config";
import { STATUS, defaultCount } from "@/lib/constants";
import {
  clearHistoryProgress,
  dashboardState,
  getHistoryProgress,
  setHistoryProgress,
} from "@/lib/dashboard-state";
import { sleep } from "@/lib/time";

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

class PlatformError extends Error {
  constructor(
    message: string,
    readonly accountId?: string,
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

function getTodayDate() {
  return dayjs.tz(new Date(), "Asia/Shanghai").format("YYYY-MM-DD");
}

export function getBlockedAccountIds() {
  return dashboardState.blockedAccountsMap.get(getTodayDate()) || [];
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
    throw new Error("暂无可用读书账号!");
  }

  return accounts[Math.floor(Math.random() * accounts.length)];
}

async function fetchPlatformJson<T>(
  path: string,
  options?: {
    method?: "GET" | "POST";
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
    method: options?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options?.timeoutMs ?? 15_000),
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage =
      payload?.message || payload?.error || text || `Platform request failed: ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

async function handlePlatformAccountError(error: PlatformError) {
  if (!error.accountId) {
    return;
  }

  if (error.message.includes("WeReadError401")) {
    await prisma.account.update({
      where: { id: error.accountId },
      data: { status: STATUS.INVALID },
    });
    return;
  }

  if (error.message.includes("WeReadError429")) {
    addBlockedAccount(error.accountId);
    return;
  }

  if (error.message.includes("WeReadError400")) {
    await sleep(10_000);
  }
}

export async function getMpArticles(
  mpId: string,
  page = 1,
  retryCount = 3,
): Promise<PlatformArticle[]> {
  const account = await getAvailableAccount();

  try {
    const articles = await fetchPlatformJson<PlatformArticle[]>(
      `/api/v2/platform/mps/${mpId}/articles`,
      {
        headers: {
          xid: account.id,
          Authorization: `Bearer ${account.token}`,
        },
        searchParams: {
          page,
        },
      },
    );

    return articles;
  } catch (error) {
    const platformError = new PlatformError(
      error instanceof Error ? error.message : "读取公众号文章失败",
      account.id,
    );

    await handlePlatformAccountError(platformError);

    if (retryCount > 0) {
      return getMpArticles(mpId, page, retryCount - 1);
    }

    throw platformError;
  }
}

export async function getMpInfo(url: string) {
  const account = await getAvailableAccount();

  try {
    return await fetchPlatformJson<PlatformMpInfo>(`/api/v2/platform/wxs2mp`, {
      method: "POST",
      body: { url: url.trim() },
      headers: {
        xid: account.id,
        Authorization: `Bearer ${account.token}`,
      },
    });
  } catch (error) {
    const platformError = new PlatformError(
      error instanceof Error ? error.message : "解析公众号失败",
      account.id,
    );

    await handlePlatformAccountError(platformError);
    throw platformError;
  }
}

export function createLoginUrl() {
  return fetchPlatformJson<LoginUrlPayload>("/api/v2/login/platform");
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
          create: { id, mpId, picUrl, publishTime, title },
          update: { picUrl, publishTime, title },
        }),
      ),
    );
  }

  const hasHistory = articles.length < defaultCount ? 0 : 1;

  await prisma.feed.update({
    where: { id: mpId },
    data: {
      syncTime: Math.floor(Date.now() / 1_000),
      hasHistory,
    },
  });

  return { hasHistory };
}

export async function refreshAllMpArticlesAndUpdateFeed() {
  if (dashboardState.isRefreshAllMpArticlesRunning) {
    return;
  }

  dashboardState.isRefreshAllMpArticlesRunning = true;
  const feeds = await prisma.feed.findMany({
    where: {
      status: STATUS.ENABLE,
    },
  });

  try {
    for (const feed of feeds) {
      await refreshMpArticlesAndUpdateFeed(feed.id);
      await sleep(getEnv().UPDATE_DELAY_TIME * 1_000);
    }
  } finally {
    dashboardState.isRefreshAllMpArticlesRunning = false;
  }
}

export async function getHistoryMpArticles(mpId: string) {
  if (getHistoryProgress().id === mpId) {
    clearHistoryProgress();
    return;
  }

  setHistoryProgress(mpId, 1);

  if (!mpId) {
    return;
  }

  try {
    const feed = await prisma.feed.findFirstOrThrow({
      where: { id: mpId },
    });

    if (feed.hasHistory === 0) {
      return;
    }

    const total = await prisma.article.count({
      where: { mpId },
    });

    setHistoryProgress(mpId, Math.ceil(total / defaultCount));

    let remaining = 1_000;
    while (remaining-- > 0) {
      if (getHistoryProgress().id !== mpId) {
        break;
      }

      const progress = getHistoryProgress();
      const { hasHistory } = await refreshMpArticlesAndUpdateFeed(mpId, progress.page);

      if (hasHistory < 1) {
        break;
      }

      setHistoryProgress(mpId, progress.page + 1);
      await sleep(getEnv().UPDATE_DELAY_TIME * 1_000);
    }
  } finally {
    clearHistoryProgress();
  }
}

export async function stopHistorySync() {
  clearHistoryProgress();
}
