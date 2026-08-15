CREATE TABLE "signup_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL UNIQUE,
  "username" varchar(64) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "date_of_birth" date NOT NULL,
  "otp_hash" varchar(255) NOT NULL,
  "otp_expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "signup_requests_username_characters" CHECK ("username" ~ '^[A-Za-z0-9._-]+$')
);