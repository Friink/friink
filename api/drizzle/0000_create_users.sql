CREATE TYPE "account_status" AS ENUM ('pending_email_verification', 'active', 'locked');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL UNIQUE,
  "username" varchar(64) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "date_of_birth" date NOT NULL,
  "status" "account_status" DEFAULT 'pending_email_verification' NOT NULL,
  "email_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_username_characters" CHECK ("username" ~ '^[A-Za-z0-9._-]+$')
);