-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "problem_source" AS ENUM ('ORIGINAL', 'LICENSED', 'EXTERNAL_REFERENCE', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "roadmap_section" AS ENUM ('FOUNDATION', 'DATA_STRUCTURES', 'TREES', 'GRAPHS', 'ADVANCED');

-- CreateEnum
CREATE TYPE "tag_relevance" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_prerequisites" (
    "topic_id" UUID NOT NULL,
    "prerequisite_id" UUID NOT NULL,

    CONSTRAINT "topic_prerequisites_pkey" PRIMARY KEY ("topic_id","prerequisite_id")
);

-- CreateTable
CREATE TABLE "patterns" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_nodes" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "parent_id" UUID,
    "section" "roadmap_section" NOT NULL,
    "display_order" INTEGER NOT NULL,
    "estimated_hours" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roadmap_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "difficulty" "difficulty" NOT NULL,
    "statement" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "examples" JSONB NOT NULL,
    "starter_code" JSONB NOT NULL,
    "time_limit_ms" INTEGER NOT NULL,
    "memory_limit_mb" INTEGER NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "source" "problem_source" NOT NULL DEFAULT 'ORIGINAL',
    "source_url" VARCHAR(500),
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "review_status" "review_status" NOT NULL DEFAULT 'DRAFT',
    "acceptance_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_topics" (
    "problem_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "relevance" "tag_relevance" NOT NULL DEFAULT 'SECONDARY',

    CONSTRAINT "problem_topics_pkey" PRIMARY KEY ("problem_id","topic_id")
);

-- CreateTable
CREATE TABLE "problem_patterns" (
    "problem_id" UUID NOT NULL,
    "pattern_id" UUID NOT NULL,
    "relevance" "tag_relevance" NOT NULL DEFAULT 'SECONDARY',

    CONSTRAINT "problem_patterns_pkey" PRIMARY KEY ("problem_id","pattern_id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hints" (
    "id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE INDEX "topic_prerequisites_prerequisite_id_idx" ON "topic_prerequisites"("prerequisite_id");

-- CreateIndex
CREATE UNIQUE INDEX "patterns_slug_key" ON "patterns"("slug");

-- CreateIndex
CREATE INDEX "roadmap_nodes_parent_id_idx" ON "roadmap_nodes"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_nodes_topic_id_key" ON "roadmap_nodes"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "problems_slug_key" ON "problems"("slug");

-- CreateIndex
CREATE INDEX "problems_difficulty_review_status_idx" ON "problems"("difficulty", "review_status");

-- CreateIndex
CREATE INDEX "problems_created_at_id_idx" ON "problems"("created_at", "id");

-- CreateIndex
CREATE INDEX "problem_topics_topic_id_problem_id_idx" ON "problem_topics"("topic_id", "problem_id");

-- CreateIndex
CREATE INDEX "problem_patterns_pattern_id_problem_id_idx" ON "problem_patterns"("pattern_id", "problem_id");

-- CreateIndex
CREATE INDEX "test_cases_problem_id_is_sample_idx" ON "test_cases"("problem_id", "is_sample");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_problem_id_display_order_key" ON "test_cases"("problem_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "hints_problem_id_level_key" ON "hints"("problem_id", "level");

-- AddForeignKey
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "roadmap_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_topics" ADD CONSTRAINT "problem_topics_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_topics" ADD CONSTRAINT "problem_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_patterns" ADD CONSTRAINT "problem_patterns_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_patterns" ADD CONSTRAINT "problem_patterns_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
