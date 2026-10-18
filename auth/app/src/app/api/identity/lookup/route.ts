import { NextResponse } from "next/server";
import { database } from "@/lib/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await database.query<{ id: string }>(
    'SELECT "id" FROM "user" WHERE lower("email") = $1 LIMIT 1',
    [email],
  );
  return NextResponse.json({ exists: result.rowCount === 1 });
}
