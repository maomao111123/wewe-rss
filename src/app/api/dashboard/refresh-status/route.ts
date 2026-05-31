import { NextRequest, NextResponse } from 'next/server';

import { assertDashboardRequest } from '@/lib/session';
import { getDashboardTasks } from '@/lib/dashboard-tasks';

export async function GET(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: '未登录' }, { status: 401 });
  }

  const isRefreshAllMpArticlesRunning = getDashboardTasks().some(
    (task) => task.status === 'running' && task.type === 'refresh-all',
  );

  return NextResponse.json({
    isRefreshAllMpArticlesRunning,
  });
}
