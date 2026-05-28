import { NextRequest, NextResponse } from "next/server";

import { assertDashboardRequest } from "@/lib/session";
import { getLoginResult, removeBlockedAccount } from "@/lib/services/platform-service";
import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  if (!assertDashboardRequest(request)) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少 id" }, { status: 400 });
  }

  const result = await getLoginResult(id);
  if (result.vid && result.token) {
    await prisma.account.upsert({
      where: { id: `${result.vid}` },
      update: {
        name: result.username || `账号 ${result.vid}`,
        token: result.token,
        status: STATUS.ENABLE,
      },
      create: {
        id: `${result.vid}`,
        name: result.username || `账号 ${result.vid}`,
        token: result.token,
        status: STATUS.ENABLE,
      },
    });
    removeBlockedAccount(`${result.vid}`);
  }

  return NextResponse.json(result);
}
