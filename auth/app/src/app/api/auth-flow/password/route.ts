import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { otpEmail, sendTransactionalEmail } from "@/lib/email/connector";
import { pendingCookie } from "@/lib/pending-auth";

export const runtime = "nodejs";

function cookieHeader(headers: Headers) {
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });

  const result = await auth.api.signInEmail({ body: { email, password }, headers: request.headers, returnHeaders: true });
  if (!result.response?.user) return NextResponse.json({ error: "Authentication failed." }, { status: 401 });

  const sessionCookies = cookieHeader(result.headers);
  if (sessionCookies) await auth.api.signOut({ headers: new Headers({ cookie: sessionCookies }) });

  const otp = String(randomInt(100000, 1000000));
  await sendTransactionalEmail({ to: email, type: "otp", subject: "Your sign-in code", html: otpEmail(otp) });
  const response = NextResponse.json({ success: true });
  response.headers.append("set-cookie", pendingCookie({ email, purpose: "login", otp, expiresAt: Date.now() + config.otpExpiresInSeconds * 1000 }));
  return response;
}
