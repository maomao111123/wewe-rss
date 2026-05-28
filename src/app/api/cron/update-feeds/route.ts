import { NextRequest, NextResponse } from "next/server";

import { getEnv, isAuthEnabled } from "@/lib/config";
import { refreshAllMpArticlesAndUpdateFeed } from "@/lib/services/platform-service";

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && request.headers.get("authorization") !== getEnv().AUTH_CODE) {
    return NextResponse.json({ message: "未授权" }, { status: 401 });
  }

  void refreshAllMpArticlesAndUpdateFeed();
  return NextResponse.json({ ok: true });
}
