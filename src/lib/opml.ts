export function buildOpml(
  feeds: Array<{ id: string; mpName: string }>,
  originUrl: string,
) {
  const outlines = feeds
    .map(
      (feed) =>
        `    <outline text="${escapeXml(feed.mpName)}" type="rss" xmlUrl="${escapeXml(
          `${originUrl}/feeds/${feed.id}.atom`,
        )}" htmlUrl="${escapeXml(`${originUrl}/feeds/${feed.id}.atom`)}" />`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>WeWeRSS 所有订阅源</title>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
