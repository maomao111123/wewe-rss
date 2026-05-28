import { NextRequest, NextResponse } from "next/server";

import { assertDashboardRequest } from "@/lib/session";
import { getHistoryProgress } from "@/lib/dashboard-state";

export async function GET(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  return NextResponse.json(getHistoryProgress());
}
