import { IsEmail, Matches } from 'class-validator';

export class VerifySignUpDto {
  @IsEmail()
  email!: string;

  @Matches(/^[A-Za-z0-9]{6}$/)
  otpCode!: string;
}