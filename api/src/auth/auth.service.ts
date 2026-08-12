import { ConflictException, Inject, Injectable, BadRequestException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Database, DATABASE } from '../database/database.module';
import { users } from '../database/schema';
import { SignUpDto } from './dto/sign-up.dto';

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async signUp(input: SignUpDto) {
    if (!hasMinimumAge(input.dateOfBirth, 13)) {
      throw new BadRequestException('You must be at least 13 years old to sign up.');
    }

    try {
      const [user] = await this.database
        .insert(users)
        .values({
          email: input.email.trim().toLowerCase(),
          username: input.username.trim().toLowerCase(),
          passwordHash: await hash(input.password, 12),
          dateOfBirth: input.dateOfBirth,
        })
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          status: users.status,
        });

      return user;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Email or username is already registered.');
      }

      throw error;
    }
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
