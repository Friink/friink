import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { database } from "@/lib/database";
import { otpEmail, sendTransactionalEmail } from "@/lib/email/connector";
import { pendingCookie } from "@/lib/pending-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; purpose?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const purpose = body?.purpose === "login" || body?.purpose === "signup" ? body.purpose : null;
  if (!purpose || !email || !email.includes("@") || email.length > 320) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  if (purpose === "signup") {
    const existing = await database.query('SELECT 1 FROM "user" WHERE lower("email") = $1 LIMIT 1', [email]);
    if (existing.rowCount) return NextResponse.json({ error: "Unable to start signup with this email." }, { status: 400 });
  }

  const otp = String(randomInt(100000, 1000000));
  await sendTransactionalEmail({ to: email, type: "otp", subject: `Your ${purpose === "login" ? "sign-in" : "email verification"} code`, html: otpEmail(otp) });
  const response = NextResponse.json({ success: true });
  response.headers.append("set-cookie", pendingCookie({ email, purpose, otp, expiresAt: Date.now() + config.otpExpiresInSeconds * 1000 }));
  return response;
}
