"use client";

import type { Article, Feed } from "@prisma/client";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addFeedsAction,
  deleteFeedAction,
  refreshFeedAction,
  setFeedStatusAction,
  toggleHistorySyncAction,
} from "@/actions/dashboard";
import { ArticleTable } from "@/components/dashboard/article-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getFeedCategory, groupFeedsByCategory } from "@/lib/feed-categories";
import { buildOpml } from "@/lib/opml";

type HistoryProgress = {
  id: string;
  page: number;
};

export function FeedsDashboard({
  feeds,
  selectedFeed,
  initialArticles,
  initialNextCursor,
  initialHistoryProgress,
  initialIsRefreshingAll,
  serverOriginUrl,
}: {
  feeds: Feed[];
  selectedFeed: Feed | null;
  initialArticles: Article[];
  initialNextCursor?: string;
  initialHistoryProgress: HistoryProgress;
  initialIsRefreshingAll: boolean;
  serverOriginUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [wxsLink, setWxsLink] = useState("");
  const [historyProgress, setHistoryProgress] = useState(initialHistoryProgress);
  const [isRefreshingAll, setIsRefreshingAll] = useState(initialIsRefreshingAll);

  useEffect(() => {
    setHistoryProgress(initialHistoryProgress);
    setIsRefreshingAll(initialIsRefreshingAll);
  }, [initialHistoryProgress, initialIsRefreshingAll]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const [historyResponse, refreshResponse] = await Promise.all([
        fetch("/api/dashboard/history-progress", { cache: "no-store" }),
        fetch("/api/dashboard/refresh-status", { cache: "no-store" }),
      ]);

      if (historyResponse.ok) {
        setHistoryProgress(await historyResponse.json());
      }

      if (refreshResponse.ok) {
        const payload = await refreshResponse.json();
        setIsRefreshingAll(payload.isRefreshAllMpArticlesRunning);
      }
    }, 10_000);

    return () => window.clearInterval(timer);
  }, []);

  const groupedFeeds = useMemo(() => groupFeedsByCategory(feeds), [feeds]);
  const currentFeedId = selectedFeed?.id || "";

  const handleAddFeeds = () => {
    startTransition(async () => {
      const result = await addFeedsAction(wxsLink);
      if (result.successes.length) {
        toast.success(`添加成功：${result.successes.join("、")}`);
      }
      if (result.errors.length) {
        toast.error(result.errors.join("\n"));
      }
      setModalOpen(false);
      setWxsLink("");
      router.refresh();
    });
  };

  const handleRefresh = (feedId?: string) => {
    startTransition(async () => {
      await refreshFeedAction(feedId);
      toast.success(feedId ? "已开始更新当前订阅源" : "已开始更新全部订阅源");
      router.refresh();
    });
  };

  const handleToggleHistory = () => {
    if (!selectedFeed) {
      return;
    }

    startTransition(async () => {
      await toggleHistorySyncAction(
        historyProgress.id === selectedFeed.id ? "" : selectedFeed.id,
      );
      router.refresh();
    });
  };

  const handleDeleteFeed = (feedId: string) => {
    if (!window.confirm("确定删除这个订阅源吗？已抓取的文章不会被删除。")) {
      return;
    }

    startTransition(async () => {
      await deleteFeedAction(feedId);
      toast.success("删除成功");
      router.push("/dash/feeds");
      router.refresh();
    });
  };

  const handleExportOpml = () => {
    const content = buildOpml(
      feeds.map((item) => ({ id: item.id, mpName: item.mpName })),
      window.location.origin,
    );
    const blob = new Blob([content], { type: "text/xml;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "WeWeRSS-All.opml";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="grid h-full gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between">
            <Button size="sm" onClick={() => setModalOpen(true)}>
              添加
            </Button>
            <span className="text-sm text-slate-500">共 {feeds.length} 个订阅</span>
          </div>

          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <Link
                href="/dash/feeds"
                className={`block rounded-lg px-3 py-2 text-sm ${
                  !currentFeedId
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
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
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                    }`}
                  >
                    <div className="font-medium">{feed.mpName}</div>
                    <div className="line-clamp-1 text-xs text-slate-500">{feed.mpIntro}</div>
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
                <h1 className="truncate text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {selectedFeed?.mpName || "全部"}
                </h1>
                {selectedFeed ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge>{getFeedCategory(selectedFeed)}</Badge>
                    <span className="text-sm text-slate-500">
                      最后更新时间：
                      {selectedFeed.syncTime
                        ? dayjs(selectedFeed.syncTime * 1_000).format("YYYY-MM-DD HH:mm:ss")
                        : "未同步"}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    查看全部文章，并支持导出 OPML。
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedFeed ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleRefresh(selectedFeed.id)}
                    >
                      立即更新
                    </Button>
                    {selectedFeed.hasHistory === 1 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          isPending ||
                          Boolean(historyProgress.id && historyProgress.id !== selectedFeed.id)
                        }
                        onClick={handleToggleHistory}
                      >
                        {historyProgress.id === selectedFeed.id
                          ? `停止获取历史文章（第 ${historyProgress.page} 页）`
                          : "获取历史文章"}
                      </Button>
                    ) : null}
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
                    <a
                      href={`${serverOriginUrl}/feeds/${selectedFeed.id}.atom`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      RSS
                    </a>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending || isRefreshingAll}
                      onClick={() => handleRefresh()}
                    >
                      {isRefreshingAll ? "更新中..." : "更新全部"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportOpml}>
                      导出 OPML
                    </Button>
                    <a
                      href={`${serverOriginUrl}/feeds/all.atom`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      RSS
                    </a>
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
              disabled={isPending || !wxsLink.startsWith("https://mp.weixin.qq.com/s/")}
            >
              {isPending ? "处理中..." : "确定"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            输入公众号文章分享链接，一行一条，如 https://mp.weixin.qq.com/s/xxxxxx
          </p>
          <Textarea value={wxsLink} onChange={(event) => setWxsLink(event.target.value)} />
        </div>
      </Modal>
    </>
  );
}
