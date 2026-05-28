import { NextRequest, NextResponse } from "next/server";

import { getDashboardArticlesPage } from "@/lib/dashboard-articles";
import { assertDashboardRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const cursor = request.nextUrl.searchParams.get("cursor");
  const mpId = request.nextUrl.searchParams.get("mpId") || undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const page = await getDashboardArticlesPage({
    cursor,
    mpId,
    limit,
  });

  return NextResponse.json(page);
}
