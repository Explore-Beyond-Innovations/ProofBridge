-- CreateTable
CREATE TABLE "public"."UserWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainKind" "public"."ChainKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_address_chainKind_key" ON "public"."UserWallet"("address", "chainKind");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_userId_chainKind_key" ON "public"."UserWallet"("userId", "chainKind");

-- CreateIndex
CREATE INDEX "UserWallet_address_idx" ON "public"."UserWallet"("address");

-- CreateIndex
CREATE INDEX "UserWallet_userId_idx" ON "public"."UserWallet"("userId");

-- AddForeignKey
ALTER TABLE "public"."UserWallet" ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill UserWallet from existing User.walletAddress.
-- EVM addresses are 42 chars (0x + 40 hex); Stellar wallets are stored as
-- 0x + 64 hex (66 chars). Anything else is a legacy dev/test row and
-- defaults to EVM, which matches the pre-Stellar historical default.
INSERT INTO "public"."UserWallet" ("id", "userId", "address", "chainKind", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "walletAddress",
    CASE
        WHEN LENGTH("walletAddress") = 66 THEN 'STELLAR'::"public"."ChainKind"
        ELSE 'EVM'::"public"."ChainKind"
    END,
    "createdAt",
    "updatedAt"
FROM "public"."User";

-- DropIndex
DROP INDEX IF EXISTS "public"."User_walletAddress_key";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "walletAddress";
