-- CreateEnum
CREATE TYPE "public"."ChainKind" AS ENUM ('EVM', 'STELLAR');

-- AlterTable
ALTER TABLE "public"."Chain" ADD COLUMN     "kind" "public"."ChainKind" NOT NULL DEFAULT 'EVM';
