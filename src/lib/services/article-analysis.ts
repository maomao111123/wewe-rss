import { load, type CheerioAPI } from 'cheerio';

export const articleContentTypes = ['sticker', 'article', 'unknown'] as const;

export type ArticleContentType = (typeof articleContentTypes)[number];

export const articleContentTypeLabels: Record<ArticleContentType, string> = {
  sticker: '贴图',
  article: '文章',
  unknown: '未知',
};

export const articleAnalysisConfig = {
  stickerSelectors: [
    '.share_content_page_hd',
    '#img_list.share_media',
    '.swiper_item',
  ],
  articleSelectors: [
    '#activity-name',
    '#page-content.rich_media_area_primary',
    '#meta_content',
    '#js_content.rich_media_content',
    '.rich_media_content',
  ],
  bodySelectors: [
    '#js_content.rich_media_content',
    '.rich_media_content',
    '#page-content.rich_media_area_primary',
  ],
  featureThresholds: {
    stickerMaxTextLength: 120,
    stickerManyImages: 6,
    articleMinTextLength: 400,
    articleMinParagraphs: 5,
  },
} as const;

type ArticleFeatures = {
  imageCount: number;
  videoCount: number;
  paragraphCount: number;
  textLength: number;
};

const descriptionMetaSelectors = [
  'meta[name="description"]',
  'meta[property="og:description"]',
  'meta[name="twitter:description"]',
] as const;

function hasAnySelector($: CheerioAPI, selectors: readonly string[]) {
  return selectors.some((selector) => $(selector).length > 0);
}

function getBodyRoot($: CheerioAPI) {
  for (const selector of articleAnalysisConfig.bodySelectors) {
    const node = $(selector).first();
    if (node.length > 0) {
      return node;
    }
  }

  return null;
}

export function normalizeArticleText(text: string) {
  return text.replace(
    /[\s\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000]+/g,
    '',
  );
}

function decodeEscapedMetaContent(value: string) {
  return value
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\n/g, '\n');
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num: string) =>
      String.fromCodePoint(Number.parseInt(num, 10)),
    );
}

function extractMetaDescriptionText($: CheerioAPI) {
  for (const selector of descriptionMetaSelectors) {
    const content = $(selector).attr('content');
    if (!content) {
      continue;
    }

    const decoded = decodeHtmlEntities(decodeEscapedMetaContent(content));
    const stripped = load(decoded).text();
    const normalized = stripped.replace(/\s+/g, ' ').trim();

    if (normalized) {
      return normalized;
    }
  }

  return '';
}

export function extractArticleFeatures($: CheerioAPI): ArticleFeatures {
  const bodyRoot = getBodyRoot($);
  const rawText = bodyRoot?.text() || extractMetaDescriptionText($);
  const textLength = normalizeArticleText(rawText).length;
  const imageCount = bodyRoot ? bodyRoot.find('img').length : $('img').length;
  const videoCount = bodyRoot
    ? bodyRoot.find('video, mpvoice, .video_iframe, iframe').length
    : $('video, mpvoice, .video_iframe, iframe').length;
  const paragraphNodes = bodyRoot
    ? bodyRoot.find('p').toArray()
    : $('p').toArray();
  const paragraphCount = paragraphNodes.filter(
    (node) => normalizeArticleText($(node).text()).length > 0,
  ).length;

  return {
    imageCount,
    videoCount,
    paragraphCount,
    textLength,
  };
}

export function classifyArticleFromHtml(html: string) {
  const $ = load(html, { decodeEntities: false });

  if (hasAnySelector($, articleAnalysisConfig.stickerSelectors)) {
    const features = extractArticleFeatures($);
    return {
      contentType: 'sticker' as const,
      textLength: features.textLength,
      features,
    };
  }

  if (hasAnySelector($, articleAnalysisConfig.articleSelectors)) {
    const features = extractArticleFeatures($);
    return {
      contentType: 'article' as const,
      textLength: features.textLength,
      features,
    };
  }

  const features = extractArticleFeatures($);
  const {
    stickerMaxTextLength,
    stickerManyImages,
    articleMinParagraphs,
    articleMinTextLength,
  } = articleAnalysisConfig.featureThresholds;

  if (
    features.imageCount > 0 &&
    features.videoCount === 0 &&
    features.textLength <= stickerMaxTextLength
  ) {
    return {
      contentType: 'sticker' as const,
      textLength: features.textLength,
      features,
    };
  }

  if (
    features.imageCount >= stickerManyImages &&
    features.textLength <= features.imageCount * stickerMaxTextLength
  ) {
    return {
      contentType: 'sticker' as const,
      textLength: features.textLength,
      features,
    };
  }

  if (
    features.videoCount > 0 ||
    features.textLength >= articleMinTextLength ||
    features.paragraphCount >= articleMinParagraphs
  ) {
    return {
      contentType: 'article' as const,
      textLength: features.textLength,
      features,
    };
  }

  return {
    contentType: 'unknown' as const,
    textLength: features.textLength,
    features,
  };
}

export async function fetchArticleHtml(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'cache-control': 'max-age=0',
      'upgrade-insecure-requests': '1',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`文章页面获取失败: ${response.status}`);
  }

  return response.text();
}

export async function analyzeArticlePage(sourceUrl: string) {
  const html = await fetchArticleHtml(sourceUrl);
  return classifyArticleFromHtml(html);
}
