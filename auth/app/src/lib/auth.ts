import { betterAuth } from 'better-auth';
import { emailOTP, multiSession, username } from 'better-auth/plugins';
import { authConfig } from './config';
import { database } from './database';
import { env } from './env';
import { otpEmail, sendTransactionalEmail } from './email/connector';

export const auth = betterAuth({
  database,
  baseURL: env.authUrl,
  secret: env.secret,
  trustedOrigins: env.trustedOrigins,
  session: {
    expiresIn: authConfig.sessionExpiresInSeconds,
    updateAge: authConfig.sessionUpdateAgeSeconds,
  },
  advanced: {
    database: {
      generateId: 'uuid',
    },
    ...(env.cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.cookieDomain,
          },
        }
      : {}),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        type: 'password-reset',
        subject: 'Reset your Friink password',
        html: `<p>Reset your password by <a href="${url}">opening this secure link</a>.</p>`,
      });
    },
  },
  plugins: [
    username(),
    multiSession({ maximumSessions: authConfig.maxSessions }),
    ...(authConfig.otpEnabled
      ? [
          emailOTP({
            expiresIn: authConfig.otpExpiresInSeconds,
            allowedAttempts: authConfig.otpMaxAttempts,
            rateLimit: {
              window: authConfig.otpResentInSeconds,
              max: authConfig.otpResentLimit,
            },
            storeOTP: 'hashed',
            sendVerificationOnSignUp: true,
            overrideDefaultEmailVerification: true,
            sendVerificationOTP: async ({ email, otp, type }) => {
              await sendTransactionalEmail({
                to: email,
                type: 'otp',
                subject: 'Your Friink verification code',
                html: otpEmail(otp, type),
              });
            },
          }),
        ]
      : []),
  ],
});
