import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyArticleFromHtml,
  normalizeArticleText,
} from '@/lib/services/article-analysis';

test('normalizeArticleText 计算正文净字数', () => {
  assert.equal(normalizeArticleText(' 你 好 \n世界\u3000'), '你好世界');
});

test('命中贴图结构时判定为 sticker', () => {
  const result = classifyArticleFromHtml(`
    <html>
      <body>
        <div class="share_content_page_hd"></div>
        <div id="img_list" class="share_media">
          <img src="a.jpg" />
          <img src="b.jpg" />
        </div>
      </body>
    </html>
  `);

  assert.equal(result.contentType, 'sticker');
});

test('命中文章结构时判定为 article，并计算正文净字数', () => {
  const result = classifyArticleFromHtml(`
    <html>
      <body>
        <h1 id="activity-name">标题</h1>
        <div id="js_content" class="rich_media_content">
          <p>第一段 文字</p>
          <p>第二段文字</p>
        </div>
      </body>
    </html>
  `);

  assert.equal(result.contentType, 'article');
  assert.equal(result.textLength, '第一段文字第二段文字'.length);
});

test('结构不明显时按内容特征回退为 unknown', () => {
  const result = classifyArticleFromHtml(`
    <html>
      <body>
        <div class="content">
          <p>简短说明</p>
        </div>
      </body>
    </html>
  `);

  assert.equal(result.contentType, 'unknown');
});

test('贴图页可从 meta description 提取正文净字数', () => {
  const result = classifyArticleFromHtml(`
    <html>
      <head>
        <meta
          name="description"
          content="\\x26lt;p\\x26gt;第一句 文案\\x26lt;/p\\x26gt;\\x0a\\x26lt;p\\x26gt;第二句文案\\x26lt;/p\\x26gt;"
        />
      </head>
      <body>
        <div class="share_content_page_hd"></div>
        <div id="img_list" class="share_media"></div>
      </body>
    </html>
  `);

  assert.equal(result.contentType, 'sticker');
  assert.equal(result.textLength, '第一句文案第二句文案'.length);
});
