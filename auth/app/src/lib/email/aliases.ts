export type TransactionalEmailType = 'otp' | 'password-reset' | 'verification' | 'security';

export function senderAddress(type: TransactionalEmailType, domain: string): string {
  const alias = type === 'otp' ? 'noreply' : 'hello';
  return `${alias}@${domain}`;
}
