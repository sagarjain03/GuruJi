-- A fifth tier for the long-haul streak badge (50 / 100 / 200 / 365 / 500 days).
-- Additive only: existing rows and tiers are untouched.
ALTER TYPE "achievement_tier" ADD VALUE 'DIAMOND';
