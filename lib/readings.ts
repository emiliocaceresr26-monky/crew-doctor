import { z } from "zod";
import { validateValue } from "./engine";
import { PARAM_BY_KEY } from "./parameters";

export const ReadingsRequest = z.object({
  astronautId: z.enum(["a1", "a2", "a3", "a4"]),
  phase: z.enum(["pre", "mission", "post"]),
  source: z.enum(["manual", "voice", "test"]),
  transcript: z.string().max(300).optional(),
  items: z.array(z.object({ parameter_key: z.string().max(40), value: z.number().finite() })).min(1).max(20),
});

/** Pure validation, exported for tests: same rules as the client (RNF-05) plus the voice whitelist. */
export function checkReadings(input: z.infer<typeof ReadingsRequest>) {
  const errors: { parameter_key: string; error: string }[] = [];
  const rows = input.items.flatMap((item) => {
    const param = PARAM_BY_KEY[item.parameter_key];
    const v = validateValue(item.parameter_key, item.value);
    if (!v.ok) { errors.push({ parameter_key: item.parameter_key, error: v.error.en }); return []; }
    if (param.psych) { errors.push({ parameter_key: param.key, error: "Psychological data is not accepted on this endpoint." }); return []; }
    if (input.source === "voice" && !param.voiceEnabled) { errors.push({ parameter_key: param.key, error: `${param.name.en} cannot be set by voice.` }); return []; }
    if (input.source === "test" && param.origin !== "app_test") { errors.push({ parameter_key: param.key, error: `${param.name.en} is not an on-screen test.` }); return []; }
    if (input.source !== "test" && (param.origin === "external" && param.key !== "exercise_minutes" || param.origin === "app_test")) {
      errors.push({ parameter_key: param.key, error: `${param.name.en} cannot be entered by the crew.` }); return [];
    }
    return [{
      astronaut_id: input.astronautId, parameter: param.key, value: v.value, mission_phase: input.phase, source: input.source,
      is_simulated: false, voice_transcript: input.source === "voice" ? input.transcript ?? null : null,
    }];
  });
  return { rows, errors };
}
