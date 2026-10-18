import { authConfig } from '../config';
import { senderAddress, type TransactionalEmailType } from './aliases';

type TransactionalEmail = {
  to: string;
  type: TransactionalEmailType;
  subject: string;
  html: string;
};

export async function sendTransactionalEmail(input: TransactionalEmail): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authConfig.emailApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Friink Auth <${senderAddress(input.type, authConfig.emailDomain)}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider rejected the message: ${response.status} ${detail}`);
  }
}

export function otpEmail(otp: string, type: string): string {
  const label = type === 'email-verification' ? 'verify your Friink email' : type === 'sign-in' ? 'complete your Friink sign-in' : 'reset your Friink password';
  return `<p>Use this code to ${label}:</p><p style="font-size:24px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires soon. If you did not request it, you can ignore this message.</p>`;
}
