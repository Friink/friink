ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "onboardingStatus" text NOT NULL DEFAULT 'pending';

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" timestamp(3) with time zone;
