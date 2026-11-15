import { clientKey, interpret, OraRequest, rateLimited } from "@/lib/ora/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * POST /api/ora — interprets one utterance. Read-only: it returns proposals and client
 * actions, and never writes anything. The transcript is not logged (it may contain health data).
 */
export async function POST(req: Request) {
  if (rateLimited(`ora:${clientKey(req)}`)) return json({ error: "rate_limited" }, 429);
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return json({ error: "too_large" }, 413);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = OraRequest.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  try {
    return json(await interpret(parsed.data.text, parsed.data.lang));
  } catch {
    return json({ error: "unavailable" }, 503); // no stack traces or internal details
  }
}
