const CATEGORY_ORDER = [
  "赚钱 / 副业 / 创业",
  "女性成长 / 自媒体",
  "情绪 / 鸡汤 / 治愈",
  "生活小妙招 / 家居",
  "漫画 / 贴图",
  "其他 / 待判断",
] as const;

export function normalizeCategoryLabel(raw: string) {
  const text = raw.trim().replace(/[｜|]/g, "/").replace(/[＋+]/g, "/");

  if (/(赚钱|搞钱|谈钱|副业|创业|变现|私域|流量主|生财|AI|ai|存钱)/.test(text)) {
    return "赚钱 / 副业 / 创业";
  }

  if (/(女性成长|女性|成长|自媒体|姑娘|姐姐|逆袭|读博)/.test(text)) {
    return "女性成长 / 自媒体";
  }

  if (/(鸡汤|人性|治愈|情绪|情感|暖阳|文摘)/.test(text)) {
    return "情绪 / 鸡汤 / 治愈";
  }

  if (/(生活小妙招|生活|家居|收纳|食光|家政|帮手)/.test(text)) {
    return "生活小妙招 / 家居";
  }

  if (/(漫画|贴图|表情包|海报|长图|卡片)/.test(text)) {
    return "漫画 / 贴图";
  }

  return text || "其他 / 待判断";
}

export function getFeedCategory(feed: { mpName: string; mpIntro: string }) {
  const intro = feed.mpIntro || "";
  const matchedCategory = intro.match(/分类[:：]\s*([^｜|\n]+)/)?.[1];

  if (matchedCategory) {
    return normalizeCategoryLabel(matchedCategory);
  }

  return normalizeCategoryLabel(`${feed.mpName} ${intro}`);
}

export function groupFeedsByCategory<T extends { mpName: string; mpIntro: string }>(
  feeds: T[],
) {
  const groups = new Map<string, T[]>();

  for (const item of feeds) {
    const category = getFeedCategory(item);
    const bucket = groups.get(category) || [];
    bucket.push(item);
    groups.set(category, bucket);
  }

  return Array.from(groups.entries())
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.mpName.localeCompare(b.mpName)),
    }))
    .sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]);
      const bIndex = CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number]);
      const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return safeA - safeB || a.category.localeCompare(b.category);
    });
}
