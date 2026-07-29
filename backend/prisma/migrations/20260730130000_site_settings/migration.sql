-- SiteSettings singleton for white-label CMS config
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
