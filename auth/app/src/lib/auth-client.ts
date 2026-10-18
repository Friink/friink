'use client';

import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, multiSessionClient, usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [usernameClient(), emailOTPClient(), multiSessionClient()],
});
