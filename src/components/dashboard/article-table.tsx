"use client";

import dayjs from "dayjs";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type ArticleItem = {
  id: string;
  mpId: string;
  title: string;
  publishTime: number;
};

export function ArticleTable({
  initialItems,
  initialNextCursor,
  selectedFeedId,
}: {
  initialItems: ArticleItem[];
  initialNextCursor?: string;
  selectedFeedId?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
    setNextCursor(initialNextCursor);
  }, [initialItems, initialNextCursor, selectedFeedId]);

  const handleLoadMore = () => {
    startTransition(async () => {
      const searchParams = new URLSearchParams({
        limit: "20",
      });

      if (selectedFeedId) {
        searchParams.set("mpId", selectedFeedId);
      }
      if (nextCursor) {
        searchParams.set("cursor", nextCursor);
      }

      const response = await fetch(`/api/dashboard/articles?${searchParams.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (response.ok) {
        setItems((current) => [...current, ...payload.items]);
        setNextCursor(payload.nextCursor);
      }
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">
              标题
            </th>
            <th className="w-48 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">
              发布时间
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
          {items.length ? (
            items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`https://mp.weixin.qq.com/s/${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-900 hover:text-blue-600 visited:text-slate-400 dark:text-slate-100"
                  >
                    {item.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {dayjs(item.publishTime * 1_000).format("YYYY-MM-DD HH:mm:ss")}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {nextCursor ? (
        <div className="flex justify-center border-t border-slate-200 p-4 dark:border-slate-800">
          <Button variant="outline" onClick={handleLoadMore} disabled={isPending}>
            {isPending ? "加载中..." : "加载更多"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
