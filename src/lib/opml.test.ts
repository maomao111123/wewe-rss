import assert from "node:assert/strict";
import test from "node:test";

import { buildOpml } from "@/lib/opml";

test("buildOpml 会生成 atom 输出并转义 XML", () => {
  const xml = buildOpml(
    [{ id: "MP_WXS_1", mpName: "A&B <test>" }],
    "https://rss.example.com",
  );

  assert.match(xml, /<opml version="2.0">/);
  assert.match(xml, /A&amp;B &lt;test&gt;/);
  assert.match(
    xml,
    /xmlUrl="https:\/\/rss\.example\.com\/feeds\/MP_WXS_1\.atom"/,
  );
});
