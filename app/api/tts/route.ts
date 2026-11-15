import { z } from "zod";
import { clientKey, rateLimited } from "@/lib/ora/server";
import { MAX_TTS_CHARS, synthesize, ttsConfigured } from "@/lib/ora/tts";

export const runtime = "nodejs";
export const maxDuration = 20;

const TtsRequest = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
  lang: z.enum(["en", "es"]).default("es"),
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * POST /api/tts — BUZZ's spoken reply, synthesised with Gemini. Returns audio/wav.
 * Any failure returns an error status so the client falls back to the browser voice.
 * The text is not logged (it may contain health data).
 */
export async function POST(req: Request) {
  if (!ttsConfigured()) return json({ error: "not_configured" }, 503);
  if (rateLimited(`tts:${clientKey(req)}`, 30)) return json({ error: "rate_limited" }, 429);
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return json({ error: "too_large" }, 413);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = TtsRequest.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  try {
    const wav = await synthesize(parsed.data.text, parsed.data.lang);
    return new Response(new Uint8Array(wav), { status: 200, headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
  } catch {
    return json({ error: "unavailable" }, 503);
  }
}
