-- CreateEnum
CREATE TYPE "mistake_category" AS ENUM ('LOGIC', 'SYNTAX', 'EDGE_CASE', 'COMPLEXITY', 'IMPLEMENTATION', 'MISREAD_PROBLEM', 'WRONG_PATTERN', 'OFF_BY_ONE', 'OVERFLOW');

-- CreateEnum
CREATE TYPE "study_session_source" AS ENUM ('PRACTICE', 'REVISION', 'CONTEST', 'ASSESSMENT');

-- CreateTable
CREATE TABLE "user_topic_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solved" INTEGER NOT NULL DEFAULT 0,
    "first_attempt_solved" INTEGER NOT NULL DEFAULT 0,
    "revision_attempts" INTEGER NOT NULL DEFAULT 0,
    "revision_successes" INTEGER NOT NULL DEFAULT 0,
    "easy_attempts" INTEGER NOT NULL DEFAULT 0,
    "easy_solved" INTEGER NOT NULL DEFAULT 0,
    "medium_attempts" INTEGER NOT NULL DEFAULT 0,
    "medium_solved" INTEGER NOT NULL DEFAULT 0,
    "hard_attempts" INTEGER NOT NULL DEFAULT 0,
    "hard_solved" INTEGER NOT NULL DEFAULT 0,
    "patterns_solved" INTEGER NOT NULL DEFAULT 0,
    "speed_ratio_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speed_samples" INTEGER NOT NULL DEFAULT 0,
    "hint_weighted_solves" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mastery_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_practiced_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_pattern_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pattern_id" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solved" INTEGER NOT NULL DEFAULT 0,
    "first_attempt_solved" INTEGER NOT NULL DEFAULT 0,
    "revision_attempts" INTEGER NOT NULL DEFAULT 0,
    "revision_successes" INTEGER NOT NULL DEFAULT 0,
    "easy_attempts" INTEGER NOT NULL DEFAULT 0,
    "easy_solved" INTEGER NOT NULL DEFAULT 0,
    "medium_attempts" INTEGER NOT NULL DEFAULT 0,
    "medium_solved" INTEGER NOT NULL DEFAULT 0,
    "hard_attempts" INTEGER NOT NULL DEFAULT 0,
    "hard_solved" INTEGER NOT NULL DEFAULT 0,
    "speed_ratio_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speed_samples" INTEGER NOT NULL DEFAULT 0,
    "hint_weighted_solves" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mastery_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_practiced_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pattern_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mistakes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "submission_id" UUID,
    "category" "mistake_category" NOT NULL,
    "what_went_wrong" TEXT NOT NULL,
    "correct_idea" TEXT,
    "ai_analysis" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mistakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "problems_attempted" INTEGER NOT NULL DEFAULT 0,
    "problems_solved" INTEGER NOT NULL DEFAULT 0,
    "source" "study_session_source" NOT NULL DEFAULT 'PRACTICE',

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_topic_progress_user_id_mastery_score_idx" ON "user_topic_progress"("user_id", "mastery_score");

-- CreateIndex
CREATE UNIQUE INDEX "user_topic_progress_user_id_topic_id_key" ON "user_topic_progress"("user_id", "topic_id");

-- CreateIndex
CREATE INDEX "user_pattern_progress_user_id_mastery_score_idx" ON "user_pattern_progress"("user_id", "mastery_score");

-- CreateIndex
CREATE UNIQUE INDEX "user_pattern_progress_user_id_pattern_id_key" ON "user_pattern_progress"("user_id", "pattern_id");

-- CreateIndex
CREATE INDEX "mistakes_user_id_category_created_at_idx" ON "mistakes"("user_id", "category", "created_at");

-- CreateIndex
CREATE INDEX "mistakes_user_id_created_at_idx" ON "mistakes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_started_at_idx" ON "study_sessions"("user_id", "started_at");

-- AddForeignKey
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pattern_progress" ADD CONSTRAINT "user_pattern_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pattern_progress" ADD CONSTRAINT "user_pattern_progress_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
