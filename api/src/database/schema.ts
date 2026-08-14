import {
  date,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const accountStatus = pgEnum('account_status', [
  'pending_email_verification',
  'active',
  'locked',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  status: accountStatus('status').default('pending_email_verification').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const signupRequests = pgTable('signup_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  otpHash: varchar('otp_hash', { length: 255 }).notNull(),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
