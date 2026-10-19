import { config } from "../config";
import { senderAddress } from "./aliases";

export type TransactionalEmailType =
  | "welcome"
  | "verification"
  | "otp"
  | "password-reset"
  | "security-alert";

type EmailInput = {
  to: string;
  type: TransactionalEmailType;
  subject: string;
  html: string;
};

export async function sendTransactionalEmail(input: EmailInput): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.emailApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Auth Service <${senderAddress(input.type, config.emailDomain)}>`,
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

export function otpEmail(otp: string): string {
  return `<p>Your authentication code is:</p><p><strong>${otp}</strong></p><p>This code expires soon. If you did not request it, you can ignore this message.</p>`;
}
