import { prisma } from '@/lib/prisma';
import {
  articleContentTypes,
  type ArticleContentType,
} from '@/lib/services/article-analysis';

type CursorPayload = {
  id: string;
  publishTime: number;
};

export type DashboardArticlesPage = {
  items: Array<{
    id: string;
    mpId: string;
    title: string;
    picUrl: string;
    publishTime: number;
    contentType: ArticleContentType;
    textLength: number;
    sourceUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  nextCursor?: string;
};

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function normalizeContentType(value: string): ArticleContentType {
  return articleContentTypes.includes(value as ArticleContentType)
    ? (value as ArticleContentType)
    : 'unknown';
}

function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as CursorPayload;
    if (!parsed?.id || typeof parsed.publishTime !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getDashboardArticlesPage(params: {
  mpId?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<DashboardArticlesPage> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const cursor = decodeCursor(params.cursor);

  const where = {
    ...(params.mpId ? { mpId: params.mpId } : {}),
    ...(cursor
      ? {
          OR: [
            { publishTime: { lt: cursor.publishTime } },
            {
              publishTime: cursor.publishTime,
              id: { lt: cursor.id },
            },
          ],
        }
      : {}),
  };

  const items = await prisma.article.findMany({
    where,
    orderBy: [{ publishTime: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const normalizedItems = items.map((item) => ({
    ...item,
    contentType: normalizeContentType(item.contentType),
  }));

  if (normalizedItems.length <= limit) {
    return { items: normalizedItems };
  }

  const pageItems = normalizedItems.slice(0, limit);
  const lastVisible = pageItems.at(-1);

  return {
    items: pageItems,
    nextCursor: lastVisible
      ? encodeCursor({
          id: lastVisible.id,
          publishTime: lastVisible.publishTime,
        })
      : undefined,
  };
}
