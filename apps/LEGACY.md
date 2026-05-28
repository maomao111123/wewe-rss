# legacy 目录说明

`C:\Users\45142\Documents\projects\formal\wewe-rss\apps` 现在只保留为迁移对照，不再是运行主链。

## 当前主链

- 根目录 `Next.js App Router`
- 根目录 `prisma/schema.prisma`
- `PostgreSQL + Prisma`
- `pnpm build / pnpm start / pnpm db:deploy`

## 这里为什么还在

- `apps/web`：旧 `Vite + React` 后台实现，对照 UI 和交互时可参考
- `apps/server`：旧 `NestJS + Prisma` 服务实现，对照业务逻辑时可参考
- `apps/server/data/wewe-rss.db`：SQLite 迁移源
- `apps/server/prisma-mysql-backup`：历史 MySQL 备份，不再作为运行期方案

## 现在不要做的事

- 不要再从 `apps/web` 或 `apps/server` 启动正式服务
- 不要再把 `apps/server/prisma/schema.prisma` 当成当前生产 schema
- 不要再把 SQLite / MySQL 当成新部署默认方案
