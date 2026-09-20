-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "verdict" AS ENUM ('ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'INTERNAL_ERROR');

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "language" "language" NOT NULL,
    "code" TEXT NOT NULL,
    "status" "submission_status" NOT NULL DEFAULT 'QUEUED',
    "verdict" "verdict",
    "runtime_ms" INTEGER,
    "memory_kb" INTEGER,
    "passed_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "compile_output" TEXT,
    "is_run" BOOLEAN NOT NULL DEFAULT false,
    "hints_used_at_submit" INTEGER NOT NULL DEFAULT 0,
    "time_spent_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_results" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "test_case_id" UUID NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "runtime_ms" INTEGER,
    "memory_kb" INTEGER,
    "actual_output" TEXT,
    "error_message" TEXT,

    CONSTRAINT "submission_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submissions_user_id_created_at_idx" ON "submissions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "submissions_user_id_problem_id_created_at_idx" ON "submissions"("user_id", "problem_id", "created_at");

-- CreateIndex
CREATE INDEX "submissions_problem_id_verdict_idx" ON "submissions"("problem_id", "verdict");

-- CreateIndex
CREATE INDEX "submission_results_test_case_id_idx" ON "submission_results"("test_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_results_submission_id_test_case_id_key" ON "submission_results"("submission_id", "test_case_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_results" ADD CONSTRAINT "submission_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_results" ADD CONSTRAINT "submission_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
