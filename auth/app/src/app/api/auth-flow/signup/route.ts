import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { clearPendingCookies, readVerifiedSignupCookie } from "@/lib/pending-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const verified = readVerifiedSignupCookie(request);
  const body = (await request.json().catch(() => null)) as { password?: unknown; name?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!verified || !password || !name) return NextResponse.json({ error: "Verify your email before creating the account." }, { status: 400 });

  const result = await auth.api.signUpEmail({ body: { email: verified.email, password, name }, headers: request.headers, returnHeaders: true });
  await database.query('UPDATE "user" SET "emailVerified" = TRUE WHERE lower("email") = $1', [verified.email]);
  if (result.response?.user) result.response.user.emailVerified = true;
  const response = NextResponse.json(result.response, { status: 200 });
  const cookies = typeof result.headers.getSetCookie === "function" ? result.headers.getSetCookie() : (result.headers.get("set-cookie") ? [result.headers.get("set-cookie") as string] : []);
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  for (const cookie of clearPendingCookies()) response.headers.append("set-cookie", cookie);
  return response;
}
