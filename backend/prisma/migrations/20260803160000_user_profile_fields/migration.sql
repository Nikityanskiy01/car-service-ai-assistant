-- CreateEnum
CREATE TYPE "PreferredContact" AS ENUM ('PHONE', 'EMAIL', 'TELEGRAM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "telegram" TEXT,
ADD COLUMN "preferred_contact" "PreferredContact";
