import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Helper: get Convex client lazily at request time
function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL env var");
  return new ConvexHttpClient(url);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { agentId, clientId, token } = body || {};

    if (!agentId || !clientId || !token) {
      return NextResponse.json(
        { error: "agentId, clientId and token are required" },
        { status: 400 }
      );
    }

    // Optionally: basic token sanity format check
    if (typeof token !== "string" || token.length < 20) {
      return NextResponse.json(
        { error: "Bot token appears invalid (length too short)" },
        { status: 400 }
      );
    }

    const convex = getConvex();

    // Persist to Convex (saveBotConfig enforces agent ownership)
    await convex.mutation(api.discord.saveBotConfig, {
      agentId,
      clientId,
      token,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/discord/bot-config error", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
