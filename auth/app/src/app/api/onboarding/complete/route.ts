import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email/connector";

export const runtime = "nodejs";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])?$/;
const RESERVED_USERNAMES = new Set(["api", "login", "logout", "signup", "onboarding", "verify", "health", "security", "settings", "account"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { username?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!USERNAME_PATTERN.test(username) || RESERVED_USERNAMES.has(username)) {
    return NextResponse.json({ error: "Choose a valid username." }, { status: 400 });
  }

  const context = await auth.$context;
  const currentUser = await context.internalAdapter.findUserById(session.user.id);
  if (!currentUser) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const current = currentUser as typeof currentUser & { onboardingStatus?: string; username?: string | null };
  if (current.onboardingStatus === "complete" && current.username === username) {
    return NextResponse.json({ username, onboardingComplete: true });
  }

  try {
    await auth.api.updateUser({
      headers: request.headers,
      body: { username },
    });
  } catch {
    return NextResponse.json({ error: "That username is already taken or unavailable." }, { status: 409 });
  }

  const completedAt = new Date();
  const completedUser = await context.internalAdapter.updateUser(session.user.id, {
    onboardingStatus: "complete",
    onboardingCompletedAt: completedAt,
  });

  await sendTransactionalEmail({
    to: completedUser.email,
    type: "welcome",
    subject: "Welcome to Friink",
    html: `<p>Welcome to Friink, ${completedUser.name}.</p><p>Your account is ready to use.</p>`,
  });

  return NextResponse.json({
    user: completedUser,
    username,
    onboardingComplete: true,
  });
}
