"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";
import { getDashboardSession } from "@/lib/session";
import {
  createLoginUrl,
  getHistoryMpArticles,
  getMpInfo,
  refreshAllMpArticlesAndUpdateFeed,
  refreshMpArticlesAndUpdateFeed,
  stopHistorySync,
} from "@/lib/services/platform-service";

async function assertAuthorized() {
  if (!(await getDashboardSession())) {
    throw new Error("未登录");
  }
}

export async function addFeedsAction(wxsLinkText: string) {
  await assertAuthorized();

  const links = wxsLinkText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const successes: string[] = [];
  const errors: string[] = [];

  for (const link of links) {
    try {
      const result = await getMpInfo(link);
      const first = result[0];

      if (!first) {
        errors.push(`${link}: 未解析到公众号信息`);
        continue;
      }

      await prisma.feed.upsert({
        where: { id: first.id },
        update: {
          mpName: first.name,
          mpCover: first.cover,
          mpIntro: first.intro,
          updateTime: first.updateTime,
          status: STATUS.ENABLE,
        },
        create: {
          id: first.id,
          mpName: first.name,
          mpCover: first.cover,
          mpIntro: first.intro,
          syncTime: Math.floor(Date.now() / 1_000),
          updateTime: first.updateTime,
          status: STATUS.ENABLE,
          hasHistory: 1,
        },
      });

      await refreshMpArticlesAndUpdateFeed(first.id);
      successes.push(first.name);
    } catch (error) {
      errors.push(
        `${link}: ${error instanceof Error ? error.message : "添加失败"}`,
      );
    }
  }

  revalidatePath("/dash/feeds");
  return { successes, errors };
}

export async function setFeedStatusAction(feedId: string, enabled: boolean) {
  await assertAuthorized();
  await prisma.feed.update({
    where: { id: feedId },
    data: {
      status: enabled ? STATUS.ENABLE : STATUS.INVALID,
    },
  });
  revalidatePath("/dash/feeds");
}

export async function deleteFeedAction(feedId: string) {
  await assertAuthorized();
  await prisma.feed.delete({
    where: { id: feedId },
  });
  revalidatePath("/dash/feeds");
}

export async function refreshFeedAction(feedId?: string) {
  await assertAuthorized();
  if (feedId) {
    await refreshMpArticlesAndUpdateFeed(feedId);
  } else {
    void refreshAllMpArticlesAndUpdateFeed();
  }
  revalidatePath("/dash/feeds");
}

export async function toggleHistorySyncAction(feedId: string) {
  await assertAuthorized();
  if (!feedId) {
    await stopHistorySync();
    return;
  }

  void getHistoryMpArticles(feedId);
}

export async function setAccountStatusAction(accountId: string, status: number) {
  await assertAuthorized();
  await prisma.account.update({
    where: { id: accountId },
    data: { status },
  });
  revalidatePath("/dash/accounts");
}

export async function deleteAccountAction(accountId: string) {
  await assertAuthorized();
  await prisma.account.delete({
    where: { id: accountId },
  });
  revalidatePath("/dash/accounts");
}

export async function createLoginUrlAction() {
  await assertAuthorized();
  return createLoginUrl();
}
