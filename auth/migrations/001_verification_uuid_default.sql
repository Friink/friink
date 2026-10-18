-- Better Auth's Email OTP server-only generator inserts verification rows
-- without an id. Keep the UUID schema compatible with that adapter path.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE "verification"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
