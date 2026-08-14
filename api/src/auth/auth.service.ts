import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomInt } from 'crypto';
import { eq, or } from 'drizzle-orm';
import { sign, type Secret, type SignOptions } from 'jsonwebtoken';
import { Database, DATABASE } from '../database/database.module';
import { signupRequests, users } from '../database/schema';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifySignUpDto } from './dto/verify-sign-up.dto';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const OTP_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SIGNUP_OTP_ENABLED = process.env.SIGNUP_OTP_ENABLED === 'true';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async signUp(input: SignUpDto) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();

    if (!hasMinimumAge(input.dateOfBirth, 13)) {
      throw new BadRequestException('You must be at least 13 years old to sign up.');
    }

    const [existingUser] = await this.database
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email or username is already registered.');
    }

    if (!SIGNUP_OTP_ENABLED) {
      const [user] = await this.database
        .insert(users)
        .values({
          name: input.name.trim(),
          email,
          username,
          passwordHash: await hash(input.password, 12),
          dateOfBirth: input.dateOfBirth,
          status: 'active',
          emailVerifiedAt: new Date(),
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          username: users.username,
          status: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
        });

      return user;
    }

    const otpCode = generateOtpCode();
    const [passwordHash, otpHash] = await Promise.all([
      hash(input.password, 12),
      hash(otpCode, 12),
    ]);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const [request] = await this.database.transaction(async (transaction) => {
      await transaction
        .delete(signupRequests)
        .where(or(eq(signupRequests.email, email), eq(signupRequests.username, username)));

      return transaction
        .insert(signupRequests)
        .values({
          name: input.name.trim(),
          email,
          username,
          passwordHash,
          dateOfBirth: input.dateOfBirth,
          otpHash,
          otpExpiresAt,
        })
        .returning({
          id: signupRequests.id,
          name: signupRequests.name,
          email: signupRequests.email,
          username: signupRequests.username,
          otpExpiresAt: signupRequests.otpExpiresAt,
        });
    });

    return {
      id: request.id,
      name: request.name,
      email: request.email,
      username: request.username,
      status: 'pending_email_verification',
      otpExpiresAt: request.otpExpiresAt,
      verificationCode: process.env.NODE_ENV === 'production' ? undefined : otpCode,
    };
  }

  async login(input: LoginDto) {
    if (!JWT_SECRET) {
      throw new BadRequestException('JWT_SECRET is required.');
    }

    const email = input.email.trim().toLowerCase();
    const [user] = await this.database
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          username: users.username,
          passwordHash: users.passwordHash,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active yet.');
    }

    const isPasswordValid = await compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const jwtOptions: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
    };

    const accessToken = sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
      },
      JWT_SECRET as Secret,
      jwtOptions,
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async verifySignUp(input: VerifySignUpDto) {
    if (!SIGNUP_OTP_ENABLED) {
      throw new BadRequestException('OTP signup is disabled.');
    }

    const email = input.email.trim().toLowerCase();
    const otpCode = input.otpCode.trim().toUpperCase();

    const [request] = await this.database
      .select()
      .from(signupRequests)
      .where(eq(signupRequests.email, email))
      .limit(1);

    if (!request) {
      throw new NotFoundException('No pending signup found for this email.');
    }

    if (request.otpExpiresAt.getTime() <= Date.now()) {
      await this.database.delete(signupRequests).where(eq(signupRequests.email, email));
      throw new BadRequestException('Verification code expired. Please sign up again.');
    }

    const isCodeValid = await compare(otpCode, request.otpHash);

    if (!isCodeValid) {
      throw new BadRequestException('Verification code is invalid.');
    }

    const [user] = await this.database.transaction(async (transaction) => {
      const [createdUser] = await transaction
        .insert(users)
        .values({
          name: request.name,
          email: request.email,
          username: request.username,
          passwordHash: request.passwordHash,
          dateOfBirth: request.dateOfBirth,
          status: 'active',
          emailVerifiedAt: new Date(),
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          username: users.username,
          status: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
        });

      await transaction.delete(signupRequests).where(eq(signupRequests.email, email));

      return [createdUser];
    });

    return user;
  }
}

function hasMinimumAge(dateOfBirth: string, minimumAge: number): boolean {
  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);

  if (Number.isNaN(birthDate.getTime())) {
    return false;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayHasOccurred =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());

  if (!birthdayHasOccurred) {
    age -= 1;
  }

  return age >= minimumAge;
}

function isUniqueConstraintViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function generateOtpCode(): string {
  let code = '';

  for (let index = 0; index < OTP_LENGTH; index += 1) {
    code += OTP_CHARACTERS[randomInt(OTP_CHARACTERS.length)];
  }

  return code;
}
