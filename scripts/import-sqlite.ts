import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "../src/lib/prisma";

type SqliteAccount = {
  id: string;
  token: string;
  name: string;
  status: number;
  created_at: unknown;
  updated_at: unknown;
};

type SqliteFeed = {
  id: string;
  mp_name: string;
  mp_cover: string;
  mp_intro: string;
  status: number;
  sync_time: number;
  update_time: number;
  created_at: unknown;
  updated_at: unknown;
  has_history: number | null;
};

type SqliteArticle = {
  id: string;
  mp_id: string;
  title: string;
  pic_url: string;
  publish_time: number;
  created_at: unknown;
  updated_at: unknown;
};

const defaultSqlitePath = resolve(process.cwd(), "apps/server/data/wewe-rss.db");

function toDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    const time = value > 1e11 ? value : value * 1_000;
    return new Date(time);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return new Date();
    }

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const time = numeric > 1e11 ? numeric : numeric * 1_000;
      return new Date(time);
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

async function syncAccounts(db: Database.Database) {
  const rows = db
    .prepare("SELECT * FROM accounts ORDER BY id ASC")
    .all() as SqliteAccount[];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await prisma.account.findUnique({ where: { id: row.id } });
    const data = {
      token: row.token,
      name: row.name,
      status: row.status,
    };

    if (!existing) {
      await prisma.account.create({
        data: {
          id: row.id,
          ...data,
          createdAt: toDate(row.created_at),
          updatedAt: toDate(row.updated_at),
        },
      });
      created += 1;
      continue;
    }

    if (
      existing.token === data.token &&
      existing.name === data.name &&
      existing.status === data.status
    ) {
      skipped += 1;
      continue;
    }

    await prisma.account.update({
      where: { id: row.id },
      data,
    });
    updated += 1;
  }

  return { total: rows.length, created, updated, skipped };
}

async function syncFeeds(db: Database.Database) {
  const rows = db
    .prepare("SELECT * FROM feeds ORDER BY id ASC")
    .all() as SqliteFeed[];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await prisma.feed.findUnique({ where: { id: row.id } });
    const data = {
      mpName: row.mp_name,
      mpCover: row.mp_cover,
      mpIntro: row.mp_intro,
      status: row.status,
      syncTime: row.sync_time,
      updateTime: row.update_time,
      hasHistory: row.has_history,
    };

    if (!existing) {
      await prisma.feed.create({
        data: {
          id: row.id,
          ...data,
          createdAt: toDate(row.created_at),
          updatedAt: toDate(row.updated_at),
        },
      });
      created += 1;
      continue;
    }

    if (
      existing.mpName === data.mpName &&
      existing.mpCover === data.mpCover &&
      existing.mpIntro === data.mpIntro &&
      existing.status === data.status &&
      existing.syncTime === data.syncTime &&
      existing.updateTime === data.updateTime &&
      existing.hasHistory === data.hasHistory
    ) {
      skipped += 1;
      continue;
    }

    await prisma.feed.update({
      where: { id: row.id },
      data,
    });
    updated += 1;
  }

  return { total: rows.length, created, updated, skipped };
}

async function syncArticles(db: Database.Database) {
  const rows = db
    .prepare("SELECT * FROM articles ORDER BY publish_time DESC, id DESC")
    .all() as SqliteArticle[];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await prisma.article.findUnique({ where: { id: row.id } });
    const data = {
      mpId: row.mp_id,
      title: row.title,
      picUrl: row.pic_url,
      publishTime: row.publish_time,
    };

    if (!existing) {
      await prisma.article.create({
        data: {
          id: row.id,
          ...data,
          createdAt: toDate(row.created_at),
          updatedAt: toDate(row.updated_at),
        },
      });
      created += 1;
      continue;
    }

    if (
      existing.mpId === data.mpId &&
      existing.title === data.title &&
      existing.picUrl === data.picUrl &&
      existing.publishTime === data.publishTime
    ) {
      skipped += 1;
      continue;
    }

    await prisma.article.update({
      where: { id: row.id },
      data,
    });
    updated += 1;
  }

  return { total: rows.length, created, updated, skipped };
}

async function main() {
  const sqlitePath = resolve(
    process.cwd(),
    process.env.SQLITE_IMPORT_PATH || defaultSqlitePath,
  );
  if (!existsSync(sqlitePath)) {
    throw new Error(`SQLite 文件不存在: ${sqlitePath}`);
  }

  const db = new Database(sqlitePath, {
    readonly: true,
    fileMustExist: true,
  });

  try {
    const accounts = await syncAccounts(db);
    const feeds = await syncFeeds(db);
    const articles = await syncArticles(db);

    const counts = await Promise.all([
      prisma.account.count(),
      prisma.feed.count(),
      prisma.article.count(),
    ]);

    console.table({
      accounts,
      feeds,
      articles,
    });
    console.log(
      JSON.stringify(
        {
          sqlitePath,
          postImportCounts: {
            accounts: counts[0],
            feeds: counts[1],
            articles: counts[2],
          },
        },
        null,
        2,
      ),
    );
  } finally {
    db.close();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("SQLite -> PostgreSQL 导入失败", error);
  await prisma.$disconnect();
  process.exit(1);
});
