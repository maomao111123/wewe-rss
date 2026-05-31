import { randomUUID } from 'node:crypto';

export type DashboardTaskType =
  | 'add-feed-refresh'
  | 'add-feed-history'
  | 'add-feed-analyze'
  | 'refresh-feed'
  | 'refresh-all'
  | 'history-sync'
  | 'analyze-feed';

export type DashboardTaskStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type DashboardTask = {
  id: string;
  name: string;
  type: DashboardTaskType;
  status: DashboardTaskStatus;
  feedId?: string;
  feedName?: string;
  groupId?: string;
  groupOrder?: number;
  error?: string;
  progressCurrent?: number;
  progressTotal?: number;
  progressLabel?: string;
  fetchedCount?: number;
  resumePage?: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
};

type InternalTask = DashboardTask & {
  cancelRequested: boolean;
  run: (taskId: string) => Promise<void>;
};

type DashboardTaskState = {
  tasks: InternalTask[];
  runningTaskId?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __weweRssDashboardTasks__: DashboardTaskState | undefined;
}

const MAX_TASKS = 100;

const dashboardTaskState: DashboardTaskState =
  global.__weweRssDashboardTasks__ ?? {
    tasks: [],
    runningTaskId: undefined,
  };

if (process.env.NODE_ENV !== 'production') {
  global.__weweRssDashboardTasks__ = dashboardTaskState;
}

function isPageResumableTask(task: DashboardTask) {
  return [
    'add-feed-refresh',
    'refresh-feed',
    'add-feed-history',
    'history-sync',
  ].includes(task.type);
}

function toPublicTask(task: InternalTask): DashboardTask {
  const { run: _run, cancelRequested: _cancelRequested, ...publicTask } = task;
  return publicTask;
}

function nowIso() {
  return new Date().toISOString();
}

function trimFinishedTasks() {
  if (dashboardTaskState.tasks.length <= MAX_TASKS) {
    return;
  }

  const finished = dashboardTaskState.tasks.filter((task) =>
    ['success', 'failed', 'skipped', 'cancelled'].includes(task.status),
  );
  const removableCount = dashboardTaskState.tasks.length - MAX_TASKS;
  const removableIds = new Set(
    finished.slice(0, removableCount).map((task) => task.id),
  );
  dashboardTaskState.tasks = dashboardTaskState.tasks.filter(
    (task) => !removableIds.has(task.id),
  );
}

function updateTask(taskId: string, updater: (task: InternalTask) => void) {
  const task = dashboardTaskState.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  updater(task);
  task.updatedAt = nowIso();
}

function shouldSkipTask(task: InternalTask) {
  if (!task.groupId || typeof task.groupOrder !== 'number') {
    return false;
  }

  const taskGroupOrder = task.groupOrder;

  return dashboardTaskState.tasks.some(
    (item) =>
      item.groupId === task.groupId &&
      typeof item.groupOrder === 'number' &&
      item.groupOrder < taskGroupOrder &&
      ['failed', 'skipped', 'cancelled'].includes(item.status),
  );
}

async function runNextTask() {
  if (dashboardTaskState.runningTaskId) {
    return;
  }

  const task = dashboardTaskState.tasks.find(
    (item) => item.status === 'queued',
  );
  if (!task) {
    return;
  }

  if (shouldSkipTask(task)) {
    updateTask(task.id, (current) => {
      current.status = 'skipped';
      current.error = '前置任务失败';
      current.finishedAt = nowIso();
    });
    void runNextTask();
    return;
  }

  dashboardTaskState.runningTaskId = task.id;
  updateTask(task.id, (current) => {
    current.status = 'running';
    current.startedAt = nowIso();
  });

  try {
    await task.run(task.id);

    updateTask(task.id, (current) => {
      current.status = current.cancelRequested ? 'cancelled' : 'success';
      current.finishedAt = nowIso();
    });
  } catch (error) {
    updateTask(task.id, (current) => {
      current.status = current.cancelRequested ? 'cancelled' : 'failed';
      current.error = error instanceof Error ? error.message : '任务执行失败';
      current.finishedAt = nowIso();
    });
  } finally {
    dashboardTaskState.runningTaskId = undefined;
    trimFinishedTasks();
    void runNextTask();
  }
}

export function enqueueDashboardTask(input: {
  name: string;
  type: DashboardTaskType;
  feedId?: string;
  feedName?: string;
  groupId?: string;
  groupOrder?: number;
  run: (taskId: string) => Promise<void>;
}) {
  const createdAt = nowIso();
  const task: InternalTask = {
    id: randomUUID(),
    name: input.name,
    type: input.type,
    status: 'queued',
    feedId: input.feedId,
    feedName: input.feedName,
    groupId: input.groupId,
    groupOrder: input.groupOrder,
    createdAt,
    updatedAt: createdAt,
    cancelRequested: false,
    run: input.run,
  };

  dashboardTaskState.tasks.push(task);
  trimFinishedTasks();
  void runNextTask();
  return toPublicTask(task);
}

export function setDashboardTaskProgress(
  taskId: string,
  progress: {
    current?: number;
    total?: number;
    label?: string;
    fetchedCount?: number;
  },
) {
  updateTask(taskId, (task) => {
    if (typeof progress.current === 'number') {
      task.progressCurrent = progress.current;
    }
    if (typeof progress.total === 'number') {
      task.progressTotal = progress.total;
    }
    if (typeof progress.label === 'string') {
      task.progressLabel = progress.label;
    }
    if (typeof progress.fetchedCount === 'number') {
      task.fetchedCount = progress.fetchedCount;
    }
  });
}

export function requestDashboardTaskCancel(taskId: string) {
  updateTask(taskId, (task) => {
    task.cancelRequested = true;
  });
}

export function retryDashboardTask(
  taskId: string,
  run?: (taskId: string) => Promise<void>,
) {
  const task = dashboardTaskState.tasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error('任务不存在');
  }

  if (!['failed', 'skipped', 'cancelled'].includes(task.status)) {
    throw new Error('只有失败、跳过或已取消的任务可以重试');
  }

  if (run) {
    task.run = run;
  }

  const originalGroupId = task.groupId;
  const originalGroupOrder = task.groupOrder;
  const detachFromGroup = task.status === 'skipped';
  const resetForRetry = (current: InternalTask, detach: boolean) => {
    const createdAt = nowIso();
    const resumePage = isPageResumableTask(current)
      ? current.progressCurrent
      : undefined;
    current.status = 'queued';
    current.error = undefined;
    current.progressCurrent = undefined;
    current.progressTotal = undefined;
    current.progressLabel = undefined;
    current.fetchedCount = undefined;
    current.resumePage =
      typeof resumePage === 'number' && resumePage > 1 ? resumePage : undefined;
    current.startedAt = undefined;
    current.finishedAt = undefined;
    current.createdAt = createdAt;
    current.updatedAt = createdAt;
    current.cancelRequested = false;

    if (detach) {
      current.groupId = undefined;
      current.groupOrder = undefined;
    }
  };

  resetForRetry(task, detachFromGroup);

  if (
    !detachFromGroup &&
    originalGroupId &&
    typeof originalGroupOrder === 'number'
  ) {
    for (const item of dashboardTaskState.tasks) {
      if (
        item.id !== task.id &&
        item.groupId === originalGroupId &&
        typeof item.groupOrder === 'number' &&
        item.groupOrder > originalGroupOrder &&
        item.status === 'skipped'
      ) {
        resetForRetry(item, false);
      }
    }
  }

  void runNextTask();

  return toPublicTask(task);
}

export function isDashboardTaskCancelled(taskId: string) {
  return (
    dashboardTaskState.tasks.find((item) => item.id === taskId)
      ?.cancelRequested ?? false
  );
}

export function getDashboardTasks() {
  return dashboardTaskState.tasks
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicTask);
}

export function getDashboardTask(taskId: string) {
  const task = dashboardTaskState.tasks.find((item) => item.id === taskId);
  return task ? toPublicTask(task) : null;
}

export function findRunningTask(predicate: (task: DashboardTask) => boolean) {
  const task = dashboardTaskState.tasks.find(
    (item) => item.status === 'running' && predicate(toPublicTask(item)),
  );
  return task ? toPublicTask(task) : null;
}
