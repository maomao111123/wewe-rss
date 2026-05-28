export const STATUS = {
  INVALID: 0,
  ENABLE: 1,
  DISABLE: 2,
} as const;

export const statusMeta = {
  [STATUS.INVALID]: { label: "失效", tone: "destructive" },
  [STATUS.ENABLE]: { label: "启用", tone: "success" },
  [STATUS.DISABLE]: { label: "禁用", tone: "warning" },
} as const;

export const feedTypes = ["rss", "atom", "json"] as const;

export const feedMimeTypeMap = {
  rss: "application/rss+xml; charset=utf-8",
  atom: "application/atom+xml; charset=utf-8",
  json: "application/feed+json; charset=utf-8",
} as const;

export const defaultCount = 20;

export const navItems = [
  { href: "/dash/feeds", label: "公众号源" },
  { href: "/dash/accounts", label: "账号管理" },
] as const;
