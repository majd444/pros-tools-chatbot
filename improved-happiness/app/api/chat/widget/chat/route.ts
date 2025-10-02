import { NextRequest, NextResponse } from "next/server";

function getConvexHttpBase(): string {
  const httpUrl = process.env.CONVEX_HTTP_URL?.replace(/\/$/, "");
  // Allow non-standard vars the user set in .env
  const env = process.env as Record<string, string | undefined>;
  const httpUrlAlt = env.Convex_HTTP?.replace(/\/$/, "");
  const httpUrlAlt2 = env.Convex_HTTP_Url?.replace(/\/$/, "");
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/$/, "");
  const base = httpUrl || httpUrlAlt || httpUrlAlt2 || convexUrl;
  if (!base) throw new Error("Missing CONVEX_HTTP_URL (or Convex_HTTP / Convex_HTTP_Url) or NEXT_PUBLIC_CONVEX_URL env var");
  return base;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-source",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const base = getConvexHttpBase();
    const body = await req.text();
    const res = await fetch(`${base}/api/chat/widget/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-source": req.headers.get("x-source") || "proxy" },
      body,
    });
    const text = await res.text();
    const response = new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    return response;
  } catch (e) {
    console.error("[proxy] widget/chat error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
