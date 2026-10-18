import type { TransactionalEmailType } from "./connector";

export function senderAddress(type: TransactionalEmailType, domain: string): string {
  const alias = type === "otp" ? "noreply" : "hello";
  return `${alias}@${domain}`;
}
