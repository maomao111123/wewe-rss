ALTER TABLE "articles"
ADD COLUMN "content_type" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "text_length" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "source_url" TEXT;
