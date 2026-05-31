import { NextRequest, NextResponse } from 'next/server';

import { assertDashboardRequest } from '@/lib/session';
import { getDashboardTasks } from '@/lib/dashboard-tasks';

export async function GET(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: '未登录' }, { status: 401 });
  }

  const runningTask = getDashboardTasks().find(
    (task) =>
      task.status === 'running' &&
      (task.type === 'history-sync' || task.type === 'add-feed-history'),
  );

  return NextResponse.json({
    id: runningTask?.feedId || '',
    page: runningTask?.progressCurrent || 1,
  });
}
