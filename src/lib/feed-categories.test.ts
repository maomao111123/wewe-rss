import assert from "node:assert/strict";
import test from "node:test";

import { getFeedCategory, groupFeedsByCategory } from "@/lib/feed-categories";

test("getFeedCategory 优先读取 intro 分类标签", () => {
  const category = getFeedCategory({
    mpName: "随便取名",
    mpIntro: "自定义导入｜分类：自媒体、女性成长",
  });

  assert.equal(category, "女性成长 / 自媒体");
});

test("groupFeedsByCategory 会按默认优先级排序", () => {
  const groups = groupFeedsByCategory([
    { mpName: "B", mpIntro: "分类：漫画", id: "2" },
    { mpName: "A", mpIntro: "分类：赚钱", id: "1" },
  ]);

  assert.equal(groups[0]?.category, "赚钱 / 副业 / 创业");
  assert.equal(groups[1]?.category, "漫画 / 贴图");
});
