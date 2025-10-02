import { NextRequest, NextResponse } from "next/server";

function getConvexHttpBase(): string {
  const httpUrl = process.env.CONVEX_HTTP_URL?.replace(/\/$/, "");
  // Allow non-standard var the user set in .env
  const env = process.env as Record<string, string | undefined>;
  const httpUrlAlt = env.Convex_HTTP?.replace(/\/$/, "");
  // Also support Convex_HTTP_Url to match user's .env
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
    const res = await fetch(`${base}/api/chat/widget/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();

    // Attempt to parse and optionally augment with env-driven field config
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = null; }

    if (payload && typeof payload === 'object') {
      const pl = payload as { agent?: Record<string, any> };
      const env = process.env as Record<string, string | undefined>;
      // Label overrides
      const labels: Record<string, string> = {
        name: env.WIDGET_LABEL_NAME || '',
        email: env.WIDGET_LABEL_EMAIL || '',
        phone: env.WIDGET_LABEL_PHONE || '',
        custom: env.WIDGET_LABEL_CUSTOM || '',
      };
      const cleanedLabels = Object.fromEntries(
        Object.entries(labels).filter(([, v]) => !!v)
      );

      // Collection config via CSV or individual flags
      const csv = (env.WIDGET_COLLECT_FIELDS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const flags = new Set(csv);
      const bool = (v?: string) => (v || '').toLowerCase() === 'true';
      if (bool(env.WIDGET_COLLECT_NAME)) flags.add('name');
      if (bool(env.WIDGET_COLLECT_EMAIL)) flags.add('email');
      if (bool(env.WIDGET_COLLECT_PHONE)) flags.add('phone');
      if (bool(env.WIDGET_COLLECT_CUSTOM)) flags.add('custom');

      const collectUserFields = Array.from(flags);

      // Ensure agent object exists
      pl.agent = pl.agent || {};
      if (collectUserFields.length > 0) {
        pl.agent.collectUserFields = collectUserFields;
      }
      if (Object.keys(cleanedLabels).length > 0) {
        pl.agent.labels = { ...pl.agent.labels, ...cleanedLabels };
      }
    }

    const responseBody = payload ? JSON.stringify(payload) : text;
    const response = new NextResponse(responseBody, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    return response;
  } catch (e) {
    console.error("[proxy] widget/session error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
