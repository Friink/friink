import { IsDateString, IsEmail, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'username may contain only letters, numbers, periods, underscores, and hyphens',
  })
  username!: string;

  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/, {
    message:
      'password must include uppercase, lowercase, number, special character, and no spaces',
  })
  password!: string;

  @IsDateString()
  dateOfBirth!: string;
}
