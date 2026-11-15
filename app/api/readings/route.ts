import { createClient } from "@supabase/supabase-js";
import { clientKey, rateLimited } from "@/lib/ora/server";
import { checkReadings, ReadingsRequest } from "@/lib/readings";

export const runtime = "nodejs";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * POST /api/readings — called by the CLIENT only after the crew member confirms. Validates
 * with zod and stores with the service-role key (server only). Without Supabase configured
 * it still validates and answers persisted:false, because the app is local-first.
 */
export async function POST(req: Request) {
  if (rateLimited(`readings:${clientKey(req)}`, 40)) return json({ error: "rate_limited" }, 429);
  if (Number(req.headers.get("content-length") ?? 0) > 8192) return json({ error: "too_large" }, 413);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = ReadingsRequest.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  const { rows, errors } = checkReadings(parsed.data);
  if (errors.length) return json({ error: "validation_failed", errors }, 422); // nothing is saved

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ ok: true, accepted: rows.length, persisted: false });
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.from("vital_readings").insert(rows);
    if (error) return json({ ok: true, accepted: rows.length, persisted: false });
    return json({ ok: true, accepted: rows.length, persisted: true });
  } catch {
    return json({ ok: true, accepted: rows.length, persisted: false });
  }
}
