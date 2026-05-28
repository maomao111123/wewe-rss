import { Feed as FeedEntity, Article } from "@prisma/client";
import type { Item } from "feed";

import { prisma } from "@/lib/prisma";
import { feedMimeTypeMap, feedTypes } from "@/lib/constants";
import { getEnv, resolveServerOriginUrl } from "@/lib/config";
import { mapWithConcurrency } from "@/lib/concurrency";
import { refreshMpArticlesAndUpdateFeed } from "@/lib/services/platform-service";

const mpCache = new Map<string, string>();

function setCache(key: string, value: string) {
  if (mpCache.size >= 5_000) {
    const firstKey = mpCache.keys().next().value;
    if (firstKey) {
      mpCache.delete(firstKey);
    }
  }

  mpCache.set(key, value);
}

export function filterFeedItemsByTitle(
  items: Item[],
  titleInclude?: string,
  titleExclude?: string,
) {
  let filtered = items;

  if (titleInclude) {
    const includes = titleInclude.split("|");
    filtered = filtered.filter((item) =>
      includes.some((keyword) => item.title?.includes(keyword)),
    );
  }

  if (titleExclude) {
    const excludes = titleExclude.split("|");
    filtered = filtered.filter(
      (item) => !excludes.some((keyword) => item.title?.includes(keyword)),
    );
  }

  return filtered;
}

async function cleanHtml(source: string) {
  const [{ load }, { minify }] = await Promise.all([
    import("cheerio"),
    import("html-minifier"),
  ]);
  const $ = load(source, { decodeEntities: false });

  const dirtyHtml = $.html($(".rich_media_content"));
  const html = dirtyHtml
    .replace(/data-src=/g, "src=")
    .replace(/opacity: 0( !important)?;/g, "")
    .replace(/visibility: hidden;/g, "");

  const content =
    '<style> .rich_media_content {overflow: hidden;color: #222;font-size: 17px;word-wrap: break-word;-webkit-hyphens: auto;-ms-hyphens: auto;hyphens: auto;text-align: justify;position: relative;z-index: 0;}.rich_media_content {font-size: 18px;}</style>' +
    html;

  return minify(content, {
    removeAttributeQuotes: true,
    collapseWhitespace: true,
  });
}

async function requestHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });

  const html = await response.text();
  return getEnv().ENABLE_CLEAN_HTML ? cleanHtml(html) : html;
}

async function tryGetContent(id: string) {
  const cached = mpCache.get(id);
  if (cached) {
    return cached;
  }

  const url = `https://mp.weixin.qq.com/s/${id}`;
  const html = await requestHtml(url).catch(() => "获取全文失败，请重试~");
  setCache(id, html);
  return html;
}

async function renderFeed(params: {
  type: string;
  feedInfo: FeedEntity;
  articles: Article[];
  requestUrl: string | URL;
  mode?: string;
}) {
  const { type, feedInfo, articles, requestUrl, mode } = params;
  const { Feed } = await import("feed");
  const globalMode = getEnv().FEED_MODE;
  const originUrl = resolveServerOriginUrl(requestUrl);
  const link = `${originUrl}/feeds/${feedInfo.id}.${type}`;
  const feed = new Feed({
    title: feedInfo.mpName,
    description: feedInfo.mpIntro,
    id: link,
    link,
    language: "zh-cn",
    image: feedInfo.mpCover,
    favicon: feedInfo.mpCover,
    copyright: "",
    updated: new Date(feedInfo.updateTime * 1_000),
    generator: "WeWe-RSS",
    author: { name: feedInfo.mpName },
  });

  const feeds = await prisma.feed.findMany({
    select: { id: true, mpName: true },
  });

  const enableFullText =
    typeof mode === "string" ? mode === "fulltext" : globalMode === "fulltext";
  const showAuthor = feedInfo.id === "all";

  await mapWithConcurrency(articles, 2, async (item) => {
    const link = `https://mp.weixin.qq.com/s/${item.id}`;
    const published = new Date(item.publishTime * 1_000);
    let content = "";

    if (enableFullText) {
      content = await tryGetContent(item.id);
    }

    feed.addItem({
      id: item.id,
      title: item.title,
      link,
      guid: link,
      content,
      date: published,
      image: item.picUrl,
      author: showAuthor
        ? [{ name: feeds.find((entry) => entry.id === item.mpId)?.mpName || "-" }]
        : undefined,
    });
  });

  return feed;
}

export async function getFeedList() {
  const data = await prisma.feed.findMany();
  return data.map((item) => ({
    id: item.id,
    name: item.mpName,
    intro: item.mpIntro,
    cover: item.mpCover,
    syncTime: item.syncTime,
    updateTime: item.updateTime,
  }));
}

export async function handleGenerateFeed(params: {
  id?: string;
  type: string;
  limit: number;
  page: number;
  requestUrl: string | URL;
  mode?: string;
  title_include?: string;
  title_exclude?: string;
}) {
  let { type } = params;
  if (!feedTypes.includes(type as (typeof feedTypes)[number])) {
    type = "atom";
  }

  let articles: Article[];
  let feedInfo: FeedEntity;

  if (params.id) {
    const feed = await prisma.feed.findFirst({
      where: { id: params.id },
    });

    if (!feed) {
      throw new Error("不存在该 feed");
    }

    feedInfo = feed;
    articles = await prisma.article.findMany({
      where: { mpId: params.id },
      orderBy: { publishTime: "desc" },
      take: params.limit,
      skip: (params.page - 1) * params.limit,
    });
  } else {
    articles = await prisma.article.findMany({
      orderBy: { publishTime: "desc" },
      take: params.limit,
      skip: (params.page - 1) * params.limit,
    });

    const originUrl = resolveServerOriginUrl(params.requestUrl);
    feedInfo = {
      id: "all",
      mpName: "WeWe-RSS All",
      mpIntro: "WeWe-RSS 全部文章",
      mpCover: `${originUrl}/favicon.ico`,
      status: 1,
      syncTime: 0,
      updateTime: Math.floor(Date.now() / 1_000),
      hasHistory: -1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const feed = await renderFeed({
    type,
    feedInfo,
    articles,
    requestUrl: params.requestUrl,
    mode: params.mode,
  });

  feed.items = filterFeedItemsByTitle(
    feed.items,
    params.title_include,
    params.title_exclude,
  );

  switch (type) {
    case "rss":
      return { content: feed.rss2(), mimeType: feedMimeTypeMap[type] };
    case "json":
      return { content: feed.json1(), mimeType: feedMimeTypeMap[type] };
    case "atom":
    default:
      return {
        content: feed.atom1(),
        mimeType: feedMimeTypeMap[type as keyof typeof feedMimeTypeMap],
      };
  }
}

export async function updateFeed(feedId: string) {
  try {
    await refreshMpArticlesAndUpdateFeed(feedId);
  } catch (error) {
    console.error("updateFeed error", error);
  }
}
