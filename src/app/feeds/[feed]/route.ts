import { NextRequest, NextResponse } from "next/server";

import { handleGenerateFeed, updateFeed } from "@/lib/services/feed-service";
import { isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ feed: string }> },
) {
  if (isRateLimited(request)) {
    return NextResponse.json({ message: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const { feed } = await context.params;
  const [id, type = "atom"] = decodeURIComponent(feed).split(".");
  const searchParams = request.nextUrl.searchParams;

  if (searchParams.get("update") === "true") {
    void updateFeed(id);
  }

  try {
    const { content, mimeType } = await handleGenerateFeed({
      id,
      type,
      limit: Number(searchParams.get("limit") || 10),
      page: Number(searchParams.get("page") || 1),
      mode: searchParams.get("mode") || undefined,
      title_include: searchParams.get("title_include") || undefined,
      title_exclude: searchParams.get("title_exclude") || undefined,
      requestUrl: request.url,
    });

    return new NextResponse(content, {
      headers: {
        "Content-Type": mimeType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "生成 feed 失败",
      },
      { status: 400 },
    );
  }
}
