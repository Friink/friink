import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = request.headers;
  const session = await auth.api.getSession({ headers });
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

  try {
    if (action === "send-current") {
      await auth.api.sendVerificationOTP({ body: { email: session.user.email, type: "email-verification" } });
      return NextResponse.json({ success: true });
    }
    if (action === "request-new") {
      if (!newEmail || !newEmail.includes("@") || newEmail.length > 320 || !/^\S+@\S+\.\S+$/.test(newEmail)) {
        return NextResponse.json({ error: "Enter a valid new email address." }, { status: 400 });
      }
      if (!/^\d{6}$/.test(otp)) return NextResponse.json({ error: "Enter the verification code." }, { status: 400 });
      await auth.api.requestEmailChangeEmailOTP({ headers, body: { newEmail, otp } });
      return NextResponse.json({ success: true });
    }
    if (action === "confirm") {
      if (!newEmail || !/^\d{6}$/.test(otp)) return NextResponse.json({ error: "Enter the verification code." }, { status: 400 });
      await auth.api.changeEmailEmailOTP({ headers, body: { newEmail, otp } });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid email-change action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "We could not complete that email change. Check the code and try again." }, { status: 400 });
  }
}
