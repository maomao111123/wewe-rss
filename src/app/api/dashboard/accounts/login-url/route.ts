import { NextRequest, NextResponse } from "next/server";

import { assertDashboardRequest } from "@/lib/session";
import { createLoginUrl } from "@/lib/services/platform-service";

export async function POST(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  return NextResponse.json(await createLoginUrl());
}
