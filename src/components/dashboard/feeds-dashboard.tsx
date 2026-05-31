'use client';

import type { Feed } from '@prisma/client';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  addFeedsAction,
  analyzeFeedAction,
  deleteFeedAction,
  refreshFeedAction,
  setFeedStatusAction,
} from '@/actions/dashboard';
import { ArticleTable } from '@/components/dashboard/article-table';
import { TaskQueue } from '@/components/dashboard/task-queue';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { DashboardArticlesPage } from '@/lib/dashboard-articles';
import type { DashboardTask } from '@/lib/dashboard-tasks';
import { getFeedCategory, groupFeedsByCategory } from '@/lib/feed-categories';

export function FeedsDashboard({
  feeds,
  selectedFeed,
  initialArticles,
  initialNextCursor,
  initialTasks,
  hasAvailableAccount,
  articleCount,
  serverOriginUrl,
}: {
  feeds: Feed[];
  selectedFeed: Feed | null;
  initialArticles: DashboardArticlesPage['items'];
  initialNextCursor?: string;
  initialTasks: DashboardTask[];
  hasAvailableAccount: boolean;
  articleCount: number;
  serverOriginUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [wxsLink, setWxsLink] = useState('');
  const [tasks, setTasks] = useState(initialTasks);
  const taskFingerprintRef = useRef(
    initialTasks
      .map((task) => `${task.id}:${task.status}:${task.updatedAt}`)
      .join('|'),
  );

  useEffect(() => {
    setTasks(initialTasks);
    taskFingerprintRef.current = initialTasks
      .map((task) => `${task.id}:${task.status}:${task.updatedAt}`)
      .join('|');
  }, [initialTasks]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const response = await fetch('/api/dashboard/tasks', {
        cache: 'no-store',
      });
      if (response.ok) {
        const payload = (await response.json()) as { items: DashboardTask[] };
        const nextFingerprint = payload.items
          .map((task) => `${task.id}:${task.status}:${task.updatedAt}`)
          .join('|');

        setTasks(payload.items);

        if (nextFingerprint !== taskFingerprintRef.current) {
          taskFingerprintRef.current = nextFingerprint;
          router.refresh();
        }
      }
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [router]);

  const groupedFeeds = useMemo(() => groupFeedsByCategory(feeds), [feeds]);
  const currentFeedId = selectedFeed?.id || '';
  const selectedFeedFetchTask = useMemo(
    () =>
      tasks.find(
        (task) =>
          task.feedId === selectedFeed?.id &&
          ['running', 'queued'].includes(task.status) &&
          (task.type === 'refresh-feed' || task.type === 'add-feed-refresh'),
      ),
    [selectedFeed?.id, tasks],
  );
  const selectedFeedAnalyzeTask = useMemo(
    () =>
      tasks.find(
        (task) =>
          task.feedId === selectedFeed?.id &&
          ['running', 'queued'].includes(task.status) &&
          (task.type === 'analyze-feed' || task.type === 'add-feed-analyze'),
      ),
    [selectedFeed?.id, tasks],
  );
  const isRefreshingAll = useMemo(
    () =>
      tasks.some(
        (task) =>
          ['running', 'queued'].includes(task.status) &&
          task.type === 'refresh-all',
      ),
    [tasks],
  );

  const handleAddFeeds = () => {
    startTransition(async () => {
      const result = await addFeedsAction(wxsLink);
      if (result.successes.length) {
        toast.success(
          `添加成功：${result.successes.join('、')}，已加入自动任务队列`,
        );
      }
      if (result.errors.length) {
        toast.error(result.errors.join('\n'));
      }
      setModalOpen(false);
      setWxsLink('');
      router.refresh();
    });
  };

  const handleRefresh = (feedId?: string) => {
    startTransition(async () => {
      await refreshFeedAction(feedId);
      toast.success(
        feedId
          ? '已开始抓取当前订阅源，完成后会自动识别类型/字数'
          : '已开始更新全部订阅源，完成后会自动识别类型/字数',
      );
      router.refresh();
    });
  };

  const handleAnalyze = () => {
    if (!selectedFeed) {
      return;
    }

    startTransition(async () => {
      await analyzeFeedAction(selectedFeed.id);
      toast.success('已加入识别类型/字数任务');
      router.refresh();
    });
  };

  const handleDeleteFeed = (feedId: string) => {
    if (!window.confirm('确定删除这个订阅源吗？已抓取的文章不会被删除。')) {
      return;
    }

    startTransition(async () => {
      await deleteFeedAction(feedId);
      toast.success('删除成功');
      router.push('/dash/feeds');
      router.refresh();
    });
  };

  const handleOpenPublicUrl = (url: string) => {
    window.location.assign(url);
  };

  return (
    <>
      <div className="grid h-full gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {!hasAvailableAccount ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              当前没有可用微信读书账号，抓取公众号文章会失败。
              <Link href="/dash/accounts" className="font-medium underline">
                去账号管理重新登录
              </Link>
            </div>
          ) : null}
          <div className="mb-4 flex items-center justify-between">
            <Button size="sm" onClick={() => setModalOpen(true)}>
              添加
            </Button>
            <span className="text-sm text-slate-500">
              共 {feeds.length} 个订阅
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <Link
                href="/dash/feeds"
                className={`block rounded-lg px-3 py-2 text-sm ${
                  !currentFeedId
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                }`}
              >
                全部
              </Link>
            </div>
            {groupedFeeds.map((group) => (
              <div key={group.category} className="space-y-1">
                <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.category} ({group.items.length})
                </div>
                {group.items.map((feed) => (
                  <Link
                    key={feed.id}
                    href={`/dash/feeds/${feed.id}`}
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      currentFeedId === feed.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={feed.mpCover}
                        alt={feed.mpName}
                        fallback={feed.mpName}
                        className="mt-0.5 h-9 w-9 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-medium">{feed.mpName}</div>
                        <div className="line-clamp-1 text-xs text-slate-500">
                          {feed.mpIntro}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  {selectedFeed ? (
                    <Avatar
                      src={selectedFeed.mpCover}
                      alt={selectedFeed.mpName}
                      fallback={selectedFeed.mpName}
                      className="h-12 w-12 shrink-0"
                    />
                  ) : null}
                  <h1 className="truncate text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {selectedFeed?.mpName || '全部'}
                  </h1>
                </div>
                {selectedFeed ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge>{getFeedCategory(selectedFeed)}</Badge>
                    <span className="text-sm text-slate-500">
                      最后更新时间：
                      {selectedFeed.syncTime
                        ? dayjs(selectedFeed.syncTime * 1_000).format(
                            'YYYY-MM-DD HH:mm:ss',
                          )
                        : '未同步'}
                    </span>
                    <span className="text-sm text-slate-500">
                      文章数：{articleCount}（文章+贴图）
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    查看全部 {articleCount} 篇文章，并支持导出 OPML。
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedFeed ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending || Boolean(selectedFeedFetchTask)}
                      onClick={() => handleRefresh(selectedFeed.id)}
                    >
                      {selectedFeedFetchTask?.status === 'running'
                        ? `抓取中（第 ${selectedFeedFetchTask.progressCurrent || 1} 页）`
                        : selectedFeedFetchTask?.status === 'queued'
                          ? '抓取任务排队中...'
                          : '立即抓取'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending || Boolean(selectedFeedAnalyzeTask)}
                      onClick={handleAnalyze}
                    >
                      {selectedFeedAnalyzeTask?.status === 'running'
                        ? '识别中...'
                        : selectedFeedAnalyzeTask?.status === 'queued'
                          ? '识别任务排队中...'
                          : '识别类型/字数'}
                    </Button>
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                      <span className="text-sm text-slate-500">定时更新</span>
                      <Switch
                        checked={selectedFeed.status === 1}
                        disabled={isPending}
                        onCheckedChange={(checked) => {
                          startTransition(async () => {
                            await setFeedStatusAction(selectedFeed.id, checked);
                            router.refresh();
                          });
                        }}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDeleteFeed(selectedFeed.id)}
                    >
                      删除
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenPublicUrl(
                          `${serverOriginUrl}/feeds/${selectedFeed.id}.rss`,
                        )
                      }
                    >
                      RSS
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending || isRefreshingAll}
                      onClick={() => handleRefresh()}
                    >
                      {isRefreshingAll ? '更新中...' : '更新全部'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenPublicUrl(`${serverOriginUrl}/feeds/all.opml`)
                      }
                    >
                      导出 OPML
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenPublicUrl(`${serverOriginUrl}/feeds/all.rss`)
                      }
                    >
                      RSS
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <ArticleTable
            initialItems={initialArticles}
            initialNextCursor={initialNextCursor}
            selectedFeedId={selectedFeed?.id}
          />
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="添加公众号源"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleAddFeeds}
              disabled={
                isPending || !wxsLink.startsWith('https://mp.weixin.qq.com/s/')
              }
            >
              {isPending ? '处理中...' : '确定'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            输入公众号文章分享链接，一行一条，如
            https://mp.weixin.qq.com/s/xxxxxx
          </p>
          <Textarea
            value={wxsLink}
            onChange={(event) => setWxsLink(event.target.value)}
          />
        </div>
      </Modal>

      <TaskQueue tasks={tasks} />
    </>
  );
}
