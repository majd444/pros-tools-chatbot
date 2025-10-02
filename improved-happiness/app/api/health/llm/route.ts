import { NextResponse } from "next/server";

type LlmHealthResponse = {
  ok?: unknown;
  hasOpenRouter?: unknown;
  hasOpenAI?: unknown;
  hasDiscordBackendKey?: unknown;
  hasDiscordPublicKey?: unknown;
};

function getConvexHttpBase(): string {
  // Prefer explicit HTTP Actions URL if provided, else fall back to regular Convex URL
  const httpUrl = process.env.CONVEX_HTTP_URL?.replace(/\/$/, "");
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/$/, "");
  const base = httpUrl || convexUrl;
  if (!base) throw new Error("Missing CONVEX_HTTP_URL or NEXT_PUBLIC_CONVEX_URL env var");
  return base;
}

export async function GET() {
  try {
    const base = getConvexHttpBase();
    const res = await fetch(`${base}/api/llm/health`, { method: "GET", headers: { "Content-Type": "application/json" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `Convex health failed: ${res.status} ${res.statusText} ${text}` }, { status: 500 });
    }
    const data: unknown = await res.json().catch(() => ({}));
    const obj: LlmHealthResponse = (data && typeof data === 'object') ? (data as LlmHealthResponse) : {};
    // Pass through only booleans and ok flag
    const payload = {
      ok: Boolean(obj.ok),
      hasOpenRouter: Boolean(obj.hasOpenRouter),
      hasOpenAI: Boolean(obj.hasOpenAI),
      hasDiscordBackendKey: Boolean(obj.hasDiscordBackendKey),
      hasDiscordPublicKey: Boolean(obj.hasDiscordPublicKey),
    };
    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message = (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string')
      ? (err as any).message
      : 'Internal error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
