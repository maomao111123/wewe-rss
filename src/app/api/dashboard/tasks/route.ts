import { NextRequest, NextResponse } from 'next/server';

import {
  getDashboardTask,
  getDashboardTasks,
  retryDashboardTask,
} from '@/lib/dashboard-tasks';
import { assertDashboardRequest } from '@/lib/session';
import {
  analyzeFeedArticles,
  fetchAllMpArticlesAndUpdateFeed,
  getHistoryMpArticles,
  refreshAllMpArticlesAndUpdateFeed,
} from '@/lib/services/platform-service';

function getRetryRun(taskId: string) {
  const task = getDashboardTask(taskId);

  if (!task) {
    throw new Error('任务不存在');
  }

  const resumePage = task.progressCurrent || task.resumePage;

  if (
    (task.type === 'add-feed-refresh' || task.type === 'refresh-feed') &&
    task.feedId
  ) {
    const startPage =
      typeof resumePage === 'number' && resumePage > 1 ? resumePage : 1;
    return async (retryTaskId: string) => {
      await fetchAllMpArticlesAndUpdateFeed(task.feedId!, {
        taskId: retryTaskId,
        startPage,
      });
    };
  }

  if (
    (task.type === 'add-feed-history' || task.type === 'history-sync') &&
    task.feedId
  ) {
    const startPage =
      typeof resumePage === 'number' && resumePage > 2 ? resumePage : 2;
    return async (retryTaskId: string) => {
      await getHistoryMpArticles(task.feedId!, {
        taskId: retryTaskId,
        startPage,
      });
    };
  }

  if (
    (task.type === 'add-feed-analyze' || task.type === 'analyze-feed') &&
    task.feedId
  ) {
    return async (retryTaskId: string) => {
      await analyzeFeedArticles(task.feedId!, { taskId: retryTaskId });
    };
  }

  if (task.type === 'refresh-all') {
    return async (retryTaskId: string) => {
      await refreshAllMpArticlesAndUpdateFeed({ taskId: retryTaskId });
    };
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: '未登录' }, { status: 401 });
  }

  return NextResponse.json({
    items: getDashboardTasks(),
  });
}

export async function POST(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: '未登录' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    taskId?: string;
  } | null;
  const taskId = payload?.taskId;

  if (!taskId) {
    return NextResponse.json({ message: 'taskId 必填' }, { status: 400 });
  }

  try {
    retryDashboardTask(taskId, getRetryRun(taskId));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '重试失败' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    items: getDashboardTasks(),
  });
}
