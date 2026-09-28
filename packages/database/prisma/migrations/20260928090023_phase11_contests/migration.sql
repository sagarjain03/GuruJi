-- CreateEnum
CREATE TYPE "contest_status" AS ENUM ('ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "contest_finish_reason" AS ENUM ('EARLY', 'TIME_UP');

-- CreateTable
CREATE TABLE "contests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "contest_status" NOT NULL DEFAULT 'ACTIVE',
    "duration_minutes" INTEGER NOT NULL,
    "hints_allowed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "finish_reason" "contest_finish_reason",
    "score" INTEGER NOT NULL DEFAULT 0,
    "max_score" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_problems" (
    "id" UUID NOT NULL,
    "contest_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "was_solved_before" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_submissions" (
    "id" UUID NOT NULL,
    "contest_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contests_user_id_started_at_idx" ON "contests"("user_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "contest_problems_contest_id_problem_id_key" ON "contest_problems"("contest_id", "problem_id");

-- CreateIndex
CREATE UNIQUE INDEX "contest_problems_contest_id_position_key" ON "contest_problems"("contest_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "contest_submissions_submission_id_key" ON "contest_submissions"("submission_id");

-- CreateIndex
CREATE INDEX "contest_submissions_contest_id_problem_id_idx" ON "contest_submissions"("contest_id", "problem_id");

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_problems" ADD CONSTRAINT "contest_problems_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_problems" ADD CONSTRAINT "contest_problems_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_submissions" ADD CONSTRAINT "contest_submissions_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_submissions" ADD CONSTRAINT "contest_submissions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_submissions" ADD CONSTRAINT "contest_submissions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: at most one ACTIVE contest per user. A partial unique index
-- cannot be expressed in schema.prisma, and checking in application code alone
-- would let two tabs starting at the same moment both succeed.
CREATE UNIQUE INDEX "contests_one_active_per_user" ON "contests"("user_id") WHERE "status" = 'ACTIVE';
