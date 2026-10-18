import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { env } from './env';

const database = new Pool({ connectionString: env.databaseUrl, max: 5 });

export const auth = betterAuth({
  database,
  baseURL: env.authUrl,
  secret: env.secret,
  trustedOrigins: env.trustedOrigins,
  ...(env.cookieDomain
    ? {
        advanced: {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.cookieDomain,
          },
        },
      }
    : {}),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});
