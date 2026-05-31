import { NextRequest, NextResponse } from "next/server";

import { resolveServerOriginUrl } from "@/lib/config";
import { buildOpml } from "@/lib/opml";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (isRateLimited(request)) {
    return NextResponse.json({ message: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const feeds = await prisma.feed.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, mpName: true },
  });
  const content = buildOpml(feeds, resolveServerOriginUrl(request.url));
  const disposition =
    request.nextUrl.searchParams.get("download") === "true"
      ? "attachment"
      : "inline";

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="WeWeRSS-All.opml"`,
    },
  });
}
