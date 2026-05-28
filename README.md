<div align="center">
  <img src="https://raw.githubusercontent.com/cooderl/wewe-rss/main/assets/logo.png" width="80" alt="WeWe RSS" />
  <h1>WeWe RSS</h1>
  <p>当前主链已收敛为单个 Next.js App Router 应用，数据库统一为 PostgreSQL + Prisma。</p>
</div>

## 当前状态

- 当前运行主链：
  - `Next.js App Router`
  - `React`
  - `Tailwind CSS`
  - `Prisma + PostgreSQL`
- 当前公共输出兼容路径：
  - `GET /feeds`
  - `GET /feeds/all.atom`
  - `GET /feeds/all.rss`
  - `GET /feeds/all.json`
  - `GET /feeds/:feed`
- 当前后台入口：
  - `/dash/login`
  - `/dash/feeds`
  - `/dash/feeds/[id]`
  - `/dash/accounts`

## legacy 是什么

legacy = **历史遗留实现**。

在这个项目里，legacy 指的是：

- `C:\Users\45142\Documents\projects\formal\wewe-rss\apps\web`
- `C:\Users\45142\Documents\projects\formal\wewe-rss\apps\server`
- `C:\Users\45142\Documents\projects\formal\wewe-rss\apps\server\data\wewe-rss.db`
- `C:\Users\45142\Documents\projects\formal\wewe-rss\apps\server\prisma-mysql-backup`

这些内容现在**只保留做迁移对照或数据来源**，不再是正式运行主链。详细说明见：

- `C:\Users\45142\Documents\projects\formal\wewe-rss\apps\LEGACY.md`

## 功能

- 支持微信公众号订阅（基于微信读书）
- 支持二维码登录读书账号
- 支持单个 feed 更新、全部 feed 更新、历史文章抓取
- 支持 RSS / Atom / JSON 输出
- 支持 OPML 导出
- 支持标题过滤：
  - `title_include`
  - `title_exclude`
- 支持 `update=true` 触发单个 feed 刷新
- 支持 `mode=fulltext` 输出全文

## 与旧版保持兼容的接口语义

### 全部 feed

```text
/feeds/all.atom
/feeds/all.rss
/feeds/all.json
```

支持参数：

- `limit`
- `page`
- `mode`
- `title_include`
- `title_exclude`

### 单个 feed

```text
/feeds/:feed
```

示例：

```text
/feeds/MP_WXS_123.atom?limit=30&page=1
/feeds/MP_WXS_123.json?title_include=张三|李四&title_exclude=广告
/feeds/MP_WXS_123.rss?update=true
```

## 环境变量

只保留 PostgreSQL 主链需要的变量：

- `DATABASE_URL`：PostgreSQL 连接串
- `AUTH_CODE`：后台登录口令
- `PORT`：应用端口
- `HOST`：监听地址
- `SERVER_ORIGIN_URL`：外部访问地址
- `FEED_MODE`：全文模式，`fulltext` 可选
- `CRON_EXPRESSION`：定时刷新表达式
- `MAX_REQUEST_PER_MINUTE`：接口限流
- `UPDATE_DELAY_TIME`：连续刷新间隔秒数
- `ENABLE_CLEAN_HTML`：是否清理正文 HTML
- `PLATFORM_URL`：读书平台代理地址

已移除：

- `DATABASE_TYPE`

当前没有对象存储需求，所以没有：

- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

示例文件：

- `C:\Users\45142\Documents\projects\formal\wewe-rss\.env.example`
- `C:\Users\45142\Documents\projects\formal\wewe-rss\.env.production.example`

## 本地开发

### 1. 启动本地 PostgreSQL

```bash
docker compose -f docker-compose.dev.yml up -d
```

默认暴露到本机：

- `127.0.0.1:54330`

### 2. 配置环境变量

```bash
cp .env.example .env
```

### 3. 安装依赖

```bash
pnpm install
```

### 4. 初始化数据库

```bash
pnpm db:deploy
```

### 5. 如果需要，把旧 SQLite 数据导入 PostgreSQL

默认迁移源：

- `C:\Users\45142\Documents\projects\formal\wewe-rss\apps\server\data\wewe-rss.db`

执行：

```bash
pnpm db:import:sqlite
```

可选自定义源路径：

```bash
SQLITE_IMPORT_PATH=/path/to/wewe-rss.db pnpm db:import:sqlite
```

### 6. 启动开发环境

```bash
pnpm dev
```

## 本地生产式启动

```bash
pnpm build
pnpm start
```

## Docker

### 主链：应用 + PostgreSQL

```bash
docker compose up -d --build
```

这会启动：

- `app`：Next.js 主应用
- `postgres`：PostgreSQL 数据库

### 从旧 SQLite 导入到 PostgreSQL

```bash
docker compose -f docker-compose.sqlite.yml --profile import up --build
```

这个文件现在的用途是：

- 启动 PostgreSQL
- 运行一次 `pnpm db:import:sqlite`

它**不再表示“SQLite 运行模式”**。

## 仓库内哪些东西已经统一

- 根目录只保留一个正式运行入口
- Prisma 主 schema 只保留 PostgreSQL provider
- `.env.example` / `.env.production.example` 已去掉 `DATABASE_TYPE`
- `Dockerfile` / `docker-compose.yml` 已切到 PostgreSQL 主链
- GitHub Docker release workflow 已改为单镜像发布

## 仓库内哪些东西还故意没删

- `apps/web`
- `apps/server`
- `apps/server/data/wewe-rss.db`
- `apps/server/prisma-mysql-backup`

原因不是“继续并行支持”，而是：

- 旧业务逻辑还需要对照
- SQLite 文件还需要作为迁移源
- MySQL 备份还可以作为历史证据，但不是运行方案

## 支持钉钉通知

`C:\Users\45142\Documents\projects\formal\wewe-rss\wewe-rss-dingtalk`

这是独立扩展目录，不属于当前主应用运行链。

## 风险声明

为了确保项目可以持续使用，部分接口请求会经过：

- `https://weread.111965.xyz`

请在自有环境内自行评估此依赖。
