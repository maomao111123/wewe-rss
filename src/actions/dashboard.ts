'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { STATUS } from '@/lib/constants';
import {
  enqueueDashboardTask,
  findRunningTask,
  getDashboardTask,
  requestDashboardTaskCancel,
} from '@/lib/dashboard-tasks';
import { getDashboardSession } from '@/lib/session';
import {
  analyzeFeedArticles,
  createLoginUrl,
  fetchAllMpArticlesAndUpdateFeed,
  getHistoryMpArticles,
  getMpInfo,
  refreshAllMpArticlesAndUpdateFeed,
} from '@/lib/services/platform-service';

async function assertAuthorized() {
  if (!(await getDashboardSession())) {
    throw new Error('未登录');
  }
}

function getTaskResumePage(taskId: string, defaultPage: number) {
  const resumePage = getDashboardTask(taskId)?.resumePage;
  return typeof resumePage === 'number' && resumePage > defaultPage
    ? resumePage
    : defaultPage;
}

function enqueueAnalyzeFeedTask(params: {
  feedId: string;
  feedName: string;
  name?: string;
  type?: 'add-feed-analyze' | 'analyze-feed';
  groupId?: string;
  groupOrder?: number;
}) {
  enqueueDashboardTask({
    name: params.name || `类型判定：${params.feedName}`,
    type: params.type || 'analyze-feed',
    feedId: params.feedId,
    feedName: params.feedName,
    groupId: params.groupId,
    groupOrder: params.groupOrder,
    run: async (taskId) => {
      await analyzeFeedArticles(params.feedId, { taskId });
    },
  });
}

export async function addFeedsAction(wxsLinkText: string) {
  await assertAuthorized();

  const links = wxsLinkText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const successes: string[] = [];
  const errors: string[] = [];

  for (const link of links) {
    try {
      const result = await getMpInfo(link);
      const first = result[0];

      if (!first) {
        errors.push(`${link}: 未解析到公众号信息`);
        continue;
      }

      await prisma.feed.upsert({
        where: { id: first.id },
        update: {
          mpName: first.name,
          mpCover: first.cover,
          mpIntro: first.intro,
          updateTime: first.updateTime,
          status: STATUS.ENABLE,
        },
        create: {
          id: first.id,
          mpName: first.name,
          mpCover: first.cover,
          mpIntro: first.intro,
          syncTime: Math.floor(Date.now() / 1_000),
          updateTime: first.updateTime,
          status: STATUS.ENABLE,
          hasHistory: 1,
        },
      });

      const groupId = randomUUID();
      enqueueDashboardTask({
        name: `立即抓取：${first.name}`,
        type: 'add-feed-refresh',
        feedId: first.id,
        feedName: first.name,
        groupId,
        groupOrder: 1,
        run: async (taskId) => {
          await fetchAllMpArticlesAndUpdateFeed(first.id, {
            taskId,
            startPage: getTaskResumePage(taskId, 1),
          });
        },
      });
      enqueueAnalyzeFeedTask({
        feedId: first.id,
        feedName: first.name,
        name: `识别类型/字数：${first.name}`,
        type: 'add-feed-analyze',
        groupId,
        groupOrder: 2,
      });
      successes.push(first.name);
    } catch (error) {
      errors.push(
        `${link}: ${error instanceof Error ? error.message : '添加失败'}`,
      );
    }
  }

  revalidatePath('/dash/feeds');
  return { successes, errors };
}

export async function setFeedStatusAction(feedId: string, enabled: boolean) {
  await assertAuthorized();
  await prisma.feed.update({
    where: { id: feedId },
    data: {
      status: enabled ? STATUS.ENABLE : STATUS.INVALID,
    },
  });
  revalidatePath('/dash/feeds');
}

export async function deleteFeedAction(feedId: string) {
  await assertAuthorized();
  await prisma.feed.delete({
    where: { id: feedId },
  });
  revalidatePath('/dash/feeds');
}

export async function refreshFeedAction(feedId?: string) {
  await assertAuthorized();
  if (feedId) {
    const feed = await prisma.feed.findUniqueOrThrow({
      where: { id: feedId },
    });
    const groupId = randomUUID();

    enqueueDashboardTask({
      name: `立即抓取：${feed.mpName}`,
      type: 'refresh-feed',
      feedId: feed.id,
      feedName: feed.mpName,
      groupId,
      groupOrder: 1,
      run: async (taskId) => {
        await fetchAllMpArticlesAndUpdateFeed(feed.id, {
          taskId,
          startPage: getTaskResumePage(taskId, 1),
        });
      },
    });
    enqueueAnalyzeFeedTask({
      feedId: feed.id,
      feedName: feed.mpName,
      name: `识别类型/字数：${feed.mpName}`,
      groupId,
      groupOrder: 2,
    });
  } else {
    const groupId = randomUUID();
    const feeds = await prisma.feed.findMany({
      where: { status: STATUS.ENABLE },
      select: { id: true, mpName: true },
      orderBy: { createdAt: 'asc' },
    });

    enqueueDashboardTask({
      name: '更新全部订阅源',
      type: 'refresh-all',
      groupId,
      groupOrder: 1,
      run: async (taskId) => {
        await refreshAllMpArticlesAndUpdateFeed({ taskId });
      },
    });
    for (const feed of feeds) {
      enqueueAnalyzeFeedTask({
        feedId: feed.id,
        feedName: feed.mpName,
        name: `识别类型/字数：${feed.mpName}`,
        groupId,
        groupOrder: 2,
      });
    }
  }
  revalidatePath('/dash/feeds');
}

export async function analyzeFeedAction(feedId: string) {
  await assertAuthorized();

  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });

  enqueueAnalyzeFeedTask({
    feedId: feed.id,
    feedName: feed.mpName,
    name: `识别类型/字数：${feed.mpName}`,
  });

  revalidatePath('/dash/feeds');
}

export async function toggleHistorySyncAction(feedId: string) {
  await assertAuthorized();
  if (!feedId) {
    const runningTask = findRunningTask(
      (task) =>
        task.type === 'history-sync' || task.type === 'add-feed-history',
    );

    if (runningTask) {
      requestDashboardTaskCancel(runningTask.id);
    }

    return;
  }

  const runningTask = findRunningTask(
    (task) =>
      task.feedId === feedId &&
      (task.type === 'history-sync' || task.type === 'add-feed-history'),
  );

  if (runningTask) {
    requestDashboardTaskCancel(runningTask.id);
    return;
  }

  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });
  const groupId = randomUUID();

  enqueueDashboardTask({
    name: `补历史：${feed.mpName}`,
    type: 'history-sync',
    feedId: feed.id,
    feedName: feed.mpName,
    groupId,
    groupOrder: 1,
    run: async (taskId) => {
      await getHistoryMpArticles(feed.id, {
        taskId,
        startPage: getTaskResumePage(taskId, 2),
      });
    },
  });
  enqueueAnalyzeFeedTask({
    feedId: feed.id,
    feedName: feed.mpName,
    groupId,
    groupOrder: 2,
  });
}

export async function setAccountStatusAction(
  accountId: string,
  status: number,
) {
  await assertAuthorized();
  await prisma.account.update({
    where: { id: accountId },
    data: { status },
  });
  revalidatePath('/dash/accounts');
}

export async function deleteAccountAction(accountId: string) {
  await assertAuthorized();
  await prisma.account.delete({
    where: { id: accountId },
  });
  revalidatePath('/dash/accounts');
}

export async function createLoginUrlAction() {
  await assertAuthorized();
  return createLoginUrl();
}
