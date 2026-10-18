import { randomInt } from 'node:crypto';
import { authConfig } from '@/lib/config';
import { otpEmail, sendTransactionalEmail } from '@/lib/email/connector';

export type PendingOtpPurpose = 'signup' | 'login';

export async function issuePendingOtp(email: string, purpose: PendingOtpPurpose) {
  const otp = String(randomInt(100000, 1000000));
  const type = purpose === 'login' ? 'sign-in' : 'email-verification';
  await sendTransactionalEmail({
    to: email,
    type: 'otp',
    subject: purpose === 'login' ? 'Your Friink sign-in code' : 'Your Friink verification code',
    html: otpEmail(otp, type),
  });
  return { otp, expiresAt: Date.now() + authConfig.otpExpiresInSeconds * 1000 };
}
