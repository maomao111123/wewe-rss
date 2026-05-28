import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/wewe_rss?schema=public";

test("filterFeedItemsByTitle 支持 include 和 exclude", async () => {
  const { filterFeedItemsByTitle } = await import("@/lib/services/feed-service");
  const items = [
    { title: "赚钱案例" },
    { title: "女性成长方法" },
    { title: "赚钱副业避坑" },
  ] as Array<{ title: string }>;

  const filtered = filterFeedItemsByTitle(
    items as Parameters<typeof filterFeedItemsByTitle>[0],
    "赚钱|女性",
    "避坑",
  );

  assert.deepEqual(
    filtered.map((item) => item.title),
    ["赚钱案例", "女性成长方法"],
  );
});
