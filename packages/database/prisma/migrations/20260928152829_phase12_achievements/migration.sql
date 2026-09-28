-- CreateEnum
CREATE TYPE "achievement_tier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "badge" VARCHAR(64) NOT NULL,
    "tier" "achievement_tier" NOT NULL,
    "unlocked_at" TIMESTAMPTZ(3) NOT NULL,
    "seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_achievements_user_id_seen_at_idx" ON "user_achievements"("user_id", "seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_badge_tier_key" ON "user_achievements"("user_id", "badge", "tier");

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
