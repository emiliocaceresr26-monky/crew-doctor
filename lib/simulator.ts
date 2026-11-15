/**
 * Telemetry simulator. Runs entirely in the browser (Vercel is serverless: no long-lived
 * process). Produces (1) a deterministic seed — 3 baseline sessions, 14 mission days and
 * 14 post-mission days per crew member — and (2) live ticks with noise and a circadian rhythm.
 *
 * Team rule: every parameter the app does not measure by itself is simulated.
 */
import { CREW } from "./crew";
import { computeBaseline, zScore } from "./engine";
import { isSimulated, PARAMETERS, PARAM_BY_KEY } from "./parameters";
import type { Astronaut, Parameter, Phase, Reading, Scenario, Source } from "./types";

export const DAY_MS = 86_400_000;
export const HISTORY_DAYS = 14;
export const HABITAT = "habitat";
export const seriesKey = (subject: string, param: string) => `${subject}:${param}`;

// Small deterministic PRNG so the seed is identical on every device and in tests.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Approximately normal noise in [-1.5, 1.5] SD (bounded so the seed never raises false alerts). */
const noise = (rnd: () => number) => Math.max(-1.5, Math.min(1.5, (rnd() + rnd() + rnd() - 1.5) * 2));

const round = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

export function sourceFor(param: Parameter): Source {
  switch (param.origin) {
    case "app_test": return "test";
    case "hardware": return param.key === "body_temp" || param.key === "spo2" ? "manual" : "sensor";
    case "external": return "external";
    case "calculated": return "calculated";
    default: return "manual";
  }
}

function clampToLimits(param: Parameter, v: number): number {
  if (!param.limits) return v;
  return Math.max(param.limits.min, Math.min(param.limits.max, v));
}

/**
 * Alert-showcase profile: one crew member whose recent in-mission values trigger most of the
 * alerts the engine can raise (caution and critical, every body system and every IITT triage
 * step). Habitat values are shared by the whole crew, so they stay on the "Simulate event"
 * panel instead. Values ramp in over the last days so the trend is visible.
 */
export const ALERT_PROFILE_ID = "a4";
export const ALERT_PROFILE: Record<string, number> = {
  // vital signs / acute
  body_temp: 38.7, spo2: 89, resting_hr: 134, hrv: 31, glucose: 52,
  headache: 3, nausea: 3, disorientation: 2, visual_symptoms: 2, pre_eva_decompression: 2,
  // infection / contagion
  infection: 1, cough: 1, rash: 1, wounds: 1, crew_contagion: 1,
  // sleep, behaviour, cognition
  sleep_hours: 4.8, effective_sleep: 4.3, kss: 8, fatigue_sp: 6, circadian_misalignment: 4.5,
  cognitive_load: 86, mood: 3, stress: 8, pvt_rt: 385, dsst: 48, contrast: 1.55, amsler: 4,
  // hydration / exercise / bone
  urine_color: 7, water_intake: 1.2, exercise_minutes: 35, bmd_vs_baseline: 93.6,
  // radiation (career dose is cumulative: the series is shifted to end here)
  radiation_dose: 612, dose_30d_bfo: 262, dose_30d_cns: 410, dose_30d_skin: 1190,
  // neuro-ocular (SANS)
  optic_nerve_diameter: 3.71, optic_sheath_area: 29.4, intraocular_pressure: 24, visual_acuity: 0.3,
  // hematology / aerobic capacity
  hemoglobin: 11.1, hemolysis_increase: 68, vo2max: 33.8,
};
/** Days over which the showcase profile drifts from its normal value to the alert value. */
const STORY_RAMP_DAYS = 4;
export const storyValue = (subject: string, key: string): number | undefined =>
  subject === ALERT_PROFILE_ID ? ALERT_PROFILE[key] : undefined;

/** Rough mGy(-Eq) per mSv of effective dose for each 30-day organ limit (simulation only). */
const ACUTE_30D_FACTOR: Record<string, number> = { dose_30d_bfo: 0.5, dose_30d_cns: 0.4, dose_30d_skin: 0.6 };

export function meanFor(param: Parameter, subject: string, scenario: Scenario): number {
  if (!param.sim) return 0;
  if (param.key === "radiation_dose") {
    const person = CREW.findIndex((a) => a.id === subject);
    return scenario.missionDay * scenario.doseRatePerDay + person * 3.5;
  }
  // Daily rate and 30-day organ doses follow the scenario's dose rate.
  if (param.key === "dose_rate_daily") return scenario.doseRatePerDay;
  const organ = ACUTE_30D_FACTOR[param.key];
  if (organ) return 30 * scenario.doseRatePerDay * organ;
  const a = CREW.find((c) => c.id === subject);
  return param.sim.mean + (a?.offsets[param.key] ?? 0);
}

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function mk(subject: string, param: Parameter, value: number, ts: number, phase: Phase, simulated: boolean, i: number): Reading {
  return {
    id: `seed_${subject}_${param.key}_${phase}_${i}`,
    subject, parameter: param.key,
    value: clampToLimits(param, round(value, param.sim?.decimals ?? 0)),
    ts, phase, source: sourceFor(param), isSimulated: simulated,
  };
}

/** Seed for one series. All seed data is synthetic, so it is flagged is_simulated. */
function seedSeries(subject: string, param: Parameter, scenario: Scenario, now: number): Reading[] {
  const sim = param.sim!;
  const rnd = mulberry32(hash(seriesKey(subject, param.key)));
  const mean = meanFor(param, subject, scenario);
  const today = startOfDay(now) + 8 * 3_600_000;
  const out: Reading[] = [];
  const isDose = param.key === "radiation_dose";

  if (param.phases.includes("pre") && !isDose) {
    // Three baseline sessions spread exactly ±1 SD, so baseline mean and SD are well defined.
    [-1, 0, 1].forEach((k, i) => out.push(mk(subject, param, mean + k * sim.sd, today - (40 - i) * DAY_MS, "pre", true, i)));
  }
  if (param.phases.includes("mission")) {
    const target = storyValue(subject, param.key);
    for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
      let v = isDose ? mean - d * scenario.doseRatePerDay : mean + noise(rnd) * sim.sd;
      // Demo storyline from the design: Mateo (a2) slept under 6 h for the last three nights.
      let story = subject === "a2" && param.key === "sleep_hours" && d <= 2;
      if (story) v = [5.4, 5.1, 5.6][d];
      // Alert-showcase profile: dose shifted to end at the target, others ramp to it.
      if (target !== undefined && isDose) { v = target - d * scenario.doseRatePerDay; story = true; }
      else if (target !== undefined && d < STORY_RAMP_DAYS) {
        const k = (STORY_RAMP_DAYS - d) / STORY_RAMP_DAYS;
        v = param.kind === "number" ? mean + (target - mean) * k : d === 0 ? target : Math.round(mean + (target - mean) * k);
        story = true;
      }
      const reading = mk(subject, param, v, today - d * DAY_MS, "mission", true, HISTORY_DAYS - d);
      // Rounding to whole numbers can push a seeded value past 2 SD of the baseline. Pull it
      // back so the only alert at first launch is the intended storyline.
      if (!story && param.z && !isDose) {
        const step = 10 ** -(sim.decimals ?? 0);
        const base = computeBaseline(out);
        while (base && Math.abs(zScore(reading.value, base, param)) >= 1.7 && Math.abs(reading.value - base.mean) >= step / 2) {
          reading.value = round(reading.value - Math.sign(reading.value - base.mean) * step, sim.decimals ?? 0);
        }
      }
      out.push(reading);
    }
  }
  if (param.phases.includes("post") && !isDose) {
    // Post-mission recovery: starts deviated in the "bad" direction and converges to baseline.
    const dir = param.z === "high" ? 1 : param.z === "low" ? -1 : 0;
    for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
      const recovered = (HISTORY_DAYS - 1 - d) / (HISTORY_DAYS - 1);
      const v = mean + dir * 1.8 * sim.sd * (1 - recovered) + noise(rnd) * sim.sd * 0.5;
      out.push(mk(subject, param, v, today - d * DAY_MS + 1, "post", true, HISTORY_DAYS - d));
    }
  }
  return out;
}

export function seedReadings(scenario: Scenario, now: number = Date.now()): Record<string, Reading[]> {
  const out: Record<string, Reading[]> = {};
  for (const param of PARAMETERS) {
    if (!param.sim || param.kind === "text") continue;
    const subjects = param.scope === "habitat" ? [HABITAT] : CREW.map((a) => a.id);
    for (const s of subjects) out[seriesKey(s, param.key)] = seedSeries(s, param, scenario, now);
  }
  return out;
}

// ── Live ticks ───────────────────────────────────────────────────────────────
/** Continuous spacecraft stream (priority 1 in the parameter document). */
export const CONTINUOUS = ["radiation_dose", "cabin_o2", "cabin_co2", "cabin_temp", "cabin_humidity"];
/** Hardware values that the demo mode streams for the crew. */
export const DEMO_STREAM = ["resting_hr", "hrv", "signal_quality", "eeg_alpha"];

export interface Effect {
  offset?: number; // added to the simulated value
  set?: number; // forces the value
  until: number;
}

const circadian = (ts: number) => Math.sin(((new Date(ts).getHours() + new Date(ts).getMinutes() / 60 - 9) / 24) * 2 * Math.PI);

let tickSeq = 0;
export function liveValue(param: Parameter, subject: string, scenario: Scenario, ts: number, last: number | undefined, effect: Effect | undefined, rnd: () => number = Math.random): number {
  const sim = param.sim!;
  let v: number;
  if (param.key === "radiation_dose") {
    // Dose only accumulates. Solar-storm effects multiply the rate through `offset`.
    const perTick = (scenario.doseRatePerDay / DAY_MS) * TICK_MS;
    v = (last ?? meanFor(param, subject, scenario)) + perTick + (effect?.offset ?? 0);
    return clampToLimits(param, round(v, 3));
  }
  const story = storyValue(subject, param.key);
  v = story !== undefined
    ? story + noise(rnd) * sim.sd * 0.3
    : meanFor(param, subject, scenario) + (sim.circadian ?? 0) * circadian(ts) + noise(rnd) * sim.sd * 0.6;
  if (effect?.offset) v += effect.offset;
  if (effect?.set !== undefined) v = effect.set + noise(rnd) * sim.sd * 0.2;
  return clampToLimits(param, round(v, sim.decimals ?? 0));
}

export const TICK_MS = 3000;

export function tick(opts: {
  scenario: Scenario; demoMode: boolean; now: number;
  latest: (subject: string, param: string) => number | undefined;
  effects: Record<string, Effect>;
  crew?: Astronaut[];
}): Reading[] {
  const { scenario, demoMode, now, latest, effects } = opts;
  const crew = opts.crew ?? CREW;
  const out: Reading[] = [];
  const push = (subject: string, key: string) => {
    const param = PARAM_BY_KEY[key];
    const k = seriesKey(subject, key);
    const eff = effects[k] && effects[k].until > now ? effects[k] : undefined;
    out.push({
      id: `t${now.toString(36)}_${(tickSeq++).toString(36)}`,
      subject, parameter: key,
      value: liveValue(param, subject, scenario, now, latest(subject, key), eff),
      ts: now, phase: "mission", source: sourceFor(param), isSimulated: isSimulated(param, demoMode),
    });
  };
  for (const key of CONTINUOUS) {
    if (PARAM_BY_KEY[key].scope === "habitat") push(HABITAT, key);
    else crew.forEach((a) => push(a.id, key));
  }
  // Hardware is simulated only in demo mode; otherwise the real device (or manual entry) feeds it.
  if (demoMode) for (const key of DEMO_STREAM) crew.forEach((a) => push(a.id, key));
  return out;
}

// ── "Simulate event" panel ───────────────────────────────────────────────────
export type DemoEventId = "co2_spike" | "fever" | "sleep_loss" | "solar_storm" | "hypoxemia";

export const DEMO_EVENTS: { id: DemoEventId; name: { en: string; es: string }; detail: { en: string; es: string } }[] = [
  { id: "co2_spike", name: { en: "CO₂ spike", es: "Pico de CO₂" }, detail: { en: "Cabin CO₂ climbs past the limit for 90 s", es: "El CO₂ de cabina supera el límite por 90 s" } },
  { id: "fever", name: { en: "Fever", es: "Fiebre" }, detail: { en: "38.6 °C for the selected crew member", es: "38,6 °C para el tripulante seleccionado" } },
  { id: "sleep_loss", name: { en: "Sleep loss", es: "Falta de sueño" }, detail: { en: "Three nights under 6 h", es: "Tres noches con menos de 6 h" } },
  { id: "solar_storm", name: { en: "Solar storm", es: "Tormenta solar" }, detail: { en: "Flare + radiation storm watch", es: "Llamarada + vigilancia de tormenta de radiación" } },
  { id: "hypoxemia", name: { en: "Hypoxemia", es: "Hipoxemia" }, detail: { en: "SpO₂ 87 % for the selected crew member", es: "SpO₂ 87 % para el tripulante seleccionado" } },
];

export interface EventResult {
  readings: Reading[];
  effects: Record<string, Effect>;
  /** series whose most recent seeded values are replaced (sleep-loss storyline) */
  replaceLast?: { key: string; values: number[] };
}

export function runDemoEvent(id: DemoEventId, astronautId: string, now: number): EventResult {
  const one = (subject: string, key: string, value: number): Reading => ({
    id: `ev_${id}_${key}_${now.toString(36)}`,
    subject, parameter: key, value, ts: now, phase: "mission",
    source: sourceFor(PARAM_BY_KEY[key]), isSimulated: true,
  });
  const until = now + 90_000;
  switch (id) {
    case "co2_spike":
      return { readings: [one(HABITAT, "cabin_co2", 4200)], effects: { [seriesKey(HABITAT, "cabin_co2")]: { set: 4200, until } } };
    case "fever":
      return { readings: [one(astronautId, "body_temp", 38.6), one(astronautId, "resting_hr", 96)], effects: { [seriesKey(astronautId, "resting_hr")]: { set: 96, until } } };
    case "hypoxemia":
      return { readings: [one(astronautId, "spo2", 87)], effects: {} };
    case "sleep_loss":
      return { readings: [], effects: {}, replaceLast: { key: seriesKey(astronautId, "sleep_hours"), values: [5.2, 4.8, 5.5] } };
    case "solar_storm":
      return {
        readings: [one(HABITAT, "solar_storm_prob", 45), one(HABITAT, "kp_index", 6), one(HABITAT, "solar_events", 2)],
        effects: Object.fromEntries(CREW.map((a) => [seriesKey(a.id, "radiation_dose"), { offset: 0.02, until }])),
      };
  }
}
