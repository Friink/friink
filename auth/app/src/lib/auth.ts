import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { Pool } from 'pg';
import { env } from './env';

const database = new Pool({ connectionString: env.databaseUrl, max: 5 });

export const auth = betterAuth({
  database,
  baseURL: env.authUrl,
  secret: env.secret,
  trustedOrigins: env.trustedOrigins,
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
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
  plugins: [username()],
});
