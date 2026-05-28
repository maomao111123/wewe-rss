import { NextRequest, NextResponse } from "next/server";

import { handleGenerateFeed } from "@/lib/services/feed-service";
import { isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (isRateLimited(request)) {
    return NextResponse.json({ message: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const searchParams = request.nextUrl.searchParams;
  const { content, mimeType } = await handleGenerateFeed({
    type: "json",
    limit: Number(searchParams.get("limit") || 30),
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
}
