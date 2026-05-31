'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { DashboardTask } from '@/lib/dashboard-tasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

const taskStatusMeta: Record<
  DashboardTask['status'],
  { label: string; tone: 'success' | 'warning' | 'destructive' | 'neutral' }
> = {
  queued: { label: '排队中', tone: 'neutral' },
  running: { label: '进行中', tone: 'warning' },
  success: { label: '成功', tone: 'success' },
  failed: { label: '失败', tone: 'destructive' },
  skipped: { label: '跳过', tone: 'neutral' },
  cancelled: { label: '已取消', tone: 'neutral' },
};

const taskTypeLabelMap: Record<DashboardTask['type'], string> = {
  'add-feed-refresh': '新增后抓取',
  'add-feed-history': '新增后补历史',
  'add-feed-analyze': '新增后识别',
  'refresh-feed': '立即抓取',
  'refresh-all': '更新全部',
  'history-sync': '补历史',
  'analyze-feed': '识别类型/字数',
};

export function TaskQueue({ tasks }: { tasks: DashboardTask[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [retryingTaskIds, setRetryingTaskIds] = useState<string[]>([]);

  const retryTask = async (taskId: string) => {
    setRetryingTaskIds((current) => [...current, taskId]);

    try {
      const response = await fetch('/api/dashboard/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message || '重试失败');
      }

      toast.success('已重新加入任务队列');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重试失败');
    } finally {
      setRetryingTaskIds((current) => current.filter((id) => id !== taskId));
    }
  };

  const runningCount = useMemo(
    () =>
      tasks.filter(
        (task) => task.status === 'running' || task.status === 'queued',
      ).length,
    [tasks],
  );

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <Button className="shadow-lg" onClick={() => setOpen(true)}>
          任务队列{runningCount > 0 ? ` (${runningCount})` : ''}
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="任务队列"
        footer={
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </div>
        }
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto">
          {tasks.length ? (
            tasks.map((task) => {
              const statusMeta = taskStatusMeta[task.status];

              return (
                <div
                  key={task.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-slate-900">
                      {task.name}
                    </div>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    <Badge>{taskTypeLabelMap[task.type]}</Badge>
                    {['failed', 'skipped', 'cancelled'].includes(
                      task.status,
                    ) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryingTaskIds.includes(task.id)}
                        onClick={() => retryTask(task.id)}
                      >
                        {retryingTaskIds.includes(task.id)
                          ? '重试中...'
                          : '重试'}
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div>
                      创建：
                      {dayjs(task.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                    {typeof task.fetchedCount === 'number' ? (
                      <div>当前已抓取：{task.fetchedCount} 篇</div>
                    ) : null}
                    {task.error ? (
                      <div className="text-red-600">错误：{task.error}</div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              暂无任务
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
