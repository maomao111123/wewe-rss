CREATE TABLE "accounts" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feeds" (
  "id" TEXT NOT NULL,
  "mp_name" TEXT NOT NULL,
  "mp_cover" TEXT NOT NULL,
  "mp_intro" TEXT NOT NULL,
  "status" INTEGER NOT NULL DEFAULT 1,
  "sync_time" INTEGER NOT NULL DEFAULT 0,
  "update_time" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "has_history" INTEGER DEFAULT 1,
  CONSTRAINT "feeds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "articles" (
  "id" TEXT NOT NULL,
  "mp_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "pic_url" TEXT NOT NULL,
  "publish_time" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accounts_status_idx" ON "accounts"("status");
CREATE INDEX "feeds_status_idx" ON "feeds"("status");
CREATE INDEX "feeds_sync_time_idx" ON "feeds"("sync_time");
CREATE INDEX "articles_mp_id_publish_time_id_idx" ON "articles"("mp_id", "publish_time", "id");
CREATE INDEX "articles_publish_time_id_idx" ON "articles"("publish_time", "id");
