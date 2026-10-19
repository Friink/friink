import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!config.internalToken || request.headers.get("x-friink-auth-internal-token") !== config.internalToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      username: session.user.username ?? null,
      emailVerified: session.user.emailVerified,
      onboardingStatus: session.user.onboardingStatus ?? null,
    },
    session: { expiresAt: session.session.expiresAt },
  }, { headers: { "Cache-Control": "no-store" } });
}
