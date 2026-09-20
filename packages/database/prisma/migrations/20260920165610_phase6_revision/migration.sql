-- CreateEnum
CREATE TYPE "revision_outcome" AS ENUM ('SOLVED_EASILY', 'SOLVED_WITH_EFFORT', 'STRUGGLED', 'FAILED');

-- CreateEnum
CREATE TYPE "revision_state" AS ENUM ('LEARNING', 'REVIEWING', 'MASTERED', 'LAPSED');

-- CreateTable
CREATE TABLE "revision_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "ladder_index" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "state" "revision_state" NOT NULL DEFAULT 'LEARNING',
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "last_reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "revision_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_reviews" (
    "id" UUID NOT NULL,
    "revision_item_id" UUID NOT NULL,
    "submission_id" UUID,
    "outcome" "revision_outcome" NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revision_items_user_id_due_at_idx" ON "revision_items"("user_id", "due_at");

-- CreateIndex
CREATE INDEX "revision_items_user_id_state_due_at_idx" ON "revision_items"("user_id", "state", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "revision_items_user_id_problem_id_key" ON "revision_items"("user_id", "problem_id");

-- CreateIndex
CREATE INDEX "revision_reviews_revision_item_id_created_at_idx" ON "revision_reviews"("revision_item_id", "created_at");

-- AddForeignKey
ALTER TABLE "revision_items" ADD CONSTRAINT "revision_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_items" ADD CONSTRAINT "revision_items_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_reviews" ADD CONSTRAINT "revision_reviews_revision_item_id_fkey" FOREIGN KEY ("revision_item_id") REFERENCES "revision_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
