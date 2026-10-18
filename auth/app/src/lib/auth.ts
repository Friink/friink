import { betterAuth } from "better-auth";
import { emailOTP, multiSession, username } from "better-auth/plugins";
import { config } from "./config";
import { database } from "./database";
import { otpEmail, sendTransactionalEmail } from "./email/connector";

export const auth = betterAuth({
  database,
  baseURL: config.authUrl,
  secret: config.secret,
  trustedOrigins: config.trustedOrigins,
  session: {
    expiresIn: config.sessionExpiresInSeconds,
    updateAge: config.sessionUpdateAgeSeconds,
  },
  ...(config.cookieDomain
    ? {
        advanced: {
          crossSubDomainCookies: {
            enabled: true,
            domain: config.cookieDomain,
          },
        },
      }
    : {}),
  user: {
    additionalFields: {
      onboardingStatus: {
        type: "string",
        required: true,
        input: false,
        defaultValue: "pending",
      },
      onboardingCompletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Signup verifies the email through the Auth flow before this endpoint is called.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        type: "password-reset",
        subject: "Reset your password",
        html: `<p>Reset your password by <a href="${url}">opening this secure link</a>.</p>`,
      });
    },
  },
  plugins: [
    username({
      displayUsername: false,
      immutableUsername: false,
    }),
    multiSession({ maximumSessions: config.maxSessions }),
    ...(config.otpEnabled
      ? [
          emailOTP({
            expiresIn: config.otpExpiresInSeconds,
            allowedAttempts: config.otpMaxAttempts,
            rateLimit: {
              window: config.otpResentInSeconds,
              max: config.otpResentLimit,
            },
            sendVerificationOnSignUp: true,
            overrideDefaultEmailVerification: true,
            storeOTP: "hashed",
            sendVerificationOTP: async ({ email, otp, type }) => {
              await sendTransactionalEmail({
                to: email,
                type: "otp",
                subject: `Your ${type.replace("-", " ")} code`,
                html: otpEmail(otp),
              });
            },
          }),
        ]
      : []),
  ],
});
