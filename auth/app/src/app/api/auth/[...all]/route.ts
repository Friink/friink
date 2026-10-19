import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";

export const runtime = "nodejs";

const handler = toNextJsHandler(auth);

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  if (origin && config.trustedOrigins.includes(origin)) {
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
}

async function handle(request: Request, method: "GET" | "POST"): Promise<Response> {
  const response = await handler[method](request);
  return withCors(request, response);
}

export async function GET(request: Request) {
  return handle(request, "GET");
}

export async function POST(request: Request) {
  return handle(request, "POST");
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !config.trustedOrigins.includes(origin)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") || "Content-Type, Accept",
      Vary: "Origin",
    },
  });
}
