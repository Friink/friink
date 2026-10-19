-- Better Auth's PostgreSQL adapter relies on database-generated UUIDs when
-- advanced.database.generateId is set to "uuid".
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "user"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "session"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "account"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
