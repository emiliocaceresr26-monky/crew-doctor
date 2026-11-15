import { describe, expect, it } from "vitest";
import { SCENARIO_BY_ID } from "@/lib/crew";
import { alertFor, computeBaseline, computeVerdict, earthArrival, evaluate, LEVEL_LABEL, LINK_WINDOW_SEC, recipientsFor, sleepDebt, validateValue, zScore } from "@/lib/engine";
import { DEMO_SIMULATED, FEATURED, isSimulated, PARAM_BY_KEY, PARAMETERS } from "@/lib/parameters";
import { ALERT_PROFILE, ALERT_PROFILE_ID, HABITAT, runDemoEvent, seedReadings, seriesKey, tick } from "@/lib/simulator";
import type { Reading } from "@/lib/types";

const P = PARAM_BY_KEY;
const mars = SCENARIO_BY_ID.mars;
const reading = (parameter: string, value: number, extra: Partial<Reading> = {}): Reading => ({
  id: "x", subject: "a1", parameter, value, ts: 1_000_000, phase: "mission", source: "manual", isSimulated: false, ...extra,
});
const pre = (parameter: string, values: number[], extra: Partial<Reading> = {}) => values.map((v) => reading(parameter, v, { phase: "pre", ...extra }));

describe("parameter catalogue", () => {
  it("has the 66 parameters of the team document plus the 17 of the extension, numbered 1..83 with unique keys", () => {
    expect(PARAMETERS).toHaveLength(83);
    expect(PARAMETERS.map((p) => p.n)).toEqual(Array.from({ length: 83 }, (_, i) => i + 1));
    expect(new Set(PARAMETERS.map((p) => p.key)).size).toBe(83);
  });
  it("matches the origin counts: 35 app, 13 hardware, 27 external, 8 calculated", () => {
    const count = (f: (o: string) => boolean) => PARAMETERS.filter((p) => f(p.origin)).length;
    expect(count((o) => o === "app_input" || o === "app_test")).toBe(35);
    expect(count((o) => o === "hardware")).toBe(13);
    expect(count((o) => o === "external")).toBe(27);
    expect(count((o) => o === "calculated")).toBe(8);
  });
  it("extension thresholds match the team document", () => {
    expect(evaluate(P.dose_30d_bfo, 250, null).level).toBe("critical");
    expect(evaluate(P.dose_30d_cns, 499, null).level).toBe("caution");
    expect(evaluate(P.dose_30d_skin, 1500, null).level).toBe("critical");
    expect(evaluate(P.optic_nerve_diameter, 3.56, null).level).toBe("caution");
    expect(evaluate(P.optic_nerve_diameter, 3.5, null).level).toBe("nominal");
    expect(evaluate(P.optic_sheath_area, 28.08, null).level).toBe("caution");
    expect(evaluate(P.vo2max, 36.4, null).level).toBe("caution");
    expect(evaluate(P.vo2max, 36.5, null).level).toBe("nominal");
    expect(evaluate(P.hemolysis_increase, 54, null).level).toBe("caution");
    expect(evaluate(P.cabin_ppco2_24h, 3, null).level).toBe("critical");
    expect(evaluate(P.bone_loss_estimate, 1.5, null).level).toBe("critical");
  });
  it("features 8 parameters in the agreed order", () => {
    expect(FEATURED.map((p) => p.key)).toEqual(["sleep_hours", "resting_hr", "hrv", "spo2", "body_temp", "radiation_dose", "cabin_co2", "pvt_rt"]);
  });
  it("every range cites a source and is flagged for specialist validation", () => {
    for (const p of PARAMETERS) if (p.range) { expect(p.range.source.length).toBeGreaterThan(5); expect(p.range.validate).toBe(true); }
  });
  it("voice whitelist excludes tests, sensors-only, external, calculated and psych questionnaires", () => {
    for (const k of ["pvt_rt", "dsst", "radiation_dose", "cabin_co2", "kp_index", "verdict", "dass21", "ucla3", "stress", "loneliness", "hrv"]) expect(P[k].voiceEnabled).toBe(false);
    for (const k of ["sleep_hours", "body_temp", "spo2", "resting_hr", "water_intake", "headache"]) expect(P[k].voiceEnabled).toBe(true);
  });
});

describe("simulation rule (is_simulated)", () => {
  it("demo mode simulates exactly 40 parameters: 27 external + 13 hardware", () => {
    expect(DEMO_SIMULATED).toHaveLength(40);
    expect(DEMO_SIMULATED.every((p) => isSimulated(p, true))).toBe(true);
    expect(PARAMETERS.filter((p) => isSimulated(p, true))).toHaveLength(40);
  });
  it("outside demo mode only the 27 external + grip strength are simulated", () => {
    const sim = PARAMETERS.filter((p) => isSimulated(p, false));
    expect(sim).toHaveLength(28);
    expect(sim.map((p) => p.key)).toContain("grip_strength");
    expect(isSimulated(P.resting_hr, false)).toBe(false);
  });
  it("crew entries and on-screen tests are never simulated", () => {
    for (const p of PARAMETERS.filter((x) => x.origin === "app_input" || x.origin === "app_test")) expect(isSimulated(p, true)).toBe(false);
  });
  it("live tick flags hardware as simulated only in demo mode", () => {
    const base = { scenario: mars, now: 5_000_000, latest: () => undefined, effects: {} };
    const off = tick({ ...base, demoMode: false });
    const on = tick({ ...base, demoMode: true });
    expect(off.every((r) => r.isSimulated && r.source === "external")).toBe(true);
    expect(off.some((r) => r.parameter === "resting_hr")).toBe(false);
    const hr = on.filter((r) => r.parameter === "resting_hr");
    expect(hr).toHaveLength(4);
    expect(hr.every((r) => r.isSimulated && r.source === "sensor")).toBe(true);
  });
  it("radiation dose only accumulates", () => {
    const [r] = tick({ scenario: mars, demoMode: false, now: 1, latest: (_s, p) => (p === "radiation_dose" ? 150 : undefined), effects: {} }).filter((x) => x.parameter === "radiation_dose");
    expect(r.value).toBeGreaterThanOrEqual(150);
  });
});

describe("validation of impossible values (RNF-05)", () => {
  it("rejects 900 bpm with a clear message and accepts 62", () => {
    const bad = validateValue("resting_hr", 900);
    expect(bad.ok).toBe(false);
    if (!bad.ok) { expect(bad.error.en).toMatch(/physically possible/); expect(bad.error.es).toMatch(/físicamente posible/); }
    expect(validateValue("resting_hr", 62)).toEqual({ ok: true, value: 62 });
  });
  it("rejects non-numbers, empty input, unknown and calculated parameters", () => {
    for (const v of ["abc", "", null, undefined, NaN, Infinity]) expect(validateValue("body_temp", v).ok).toBe(false);
    expect(validateValue("nope", 1).ok).toBe(false);
    expect(validateValue("verdict", 1).ok).toBe(false);
    expect(validateValue("one_off_event", 1).ok).toBe(false);
  });
  it("accepts decimal comma, enforces integer scales and inclusive limits", () => {
    expect(validateValue("body_temp", "36,8")).toEqual({ ok: true, value: 36.8 });
    expect(validateValue("kss", 3.5).ok).toBe(false);
    expect(validateValue("spo2", 100).ok).toBe(true);
    expect(validateValue("spo2", 101).ok).toBe(false);
    expect(validateValue("sleep_hours", -1).ok).toBe(false);
  });
});

describe("baseline and z-score", () => {
  it("needs 3 pre-mission sessions and ignores one-off events", () => {
    expect(computeBaseline(pre("sleep_hours", [7, 7.5]))).toBeNull();
    const b = computeBaseline([...pre("sleep_hours", [7, 7.5, 8]), ...pre("sleep_hours", [2], { excludedFromBaseline: true }), reading("sleep_hours", 3)]);
    expect(b).toMatchObject({ mean: 7.5, n: 3 });
    expect(b!.sd).toBeCloseTo(0.5);
  });
  it("floors the SD so a flat baseline does not explode", () => {
    const flat = computeBaseline(pre("resting_hr", [60, 60, 60]))!;
    expect(flat.sd).toBe(0);
    expect(Number.isFinite(zScore(63, flat, P.resting_hr))).toBe(true);
    expect(Math.abs(zScore(60.5, flat, P.resting_hr))).toBeLessThan(2);
  });
});

describe("alert engine: thresholds + personal baseline", () => {
  it("sleep: >= 6 h nominal, < 6 h caution (RF-04)", () => {
    expect(evaluate(P.sleep_hours, 6, null).level).toBe("nominal");
    expect(evaluate(P.sleep_hours, 5.9, null).level).toBe("caution");
  });
  it("radiation: < 450 nominal, 450 caution, >= 600 critical", () => {
    expect(evaluate(P.radiation_dose, 449.9, null).level).toBe("nominal");
    expect(evaluate(P.radiation_dose, 450, null).level).toBe("caution");
    expect(evaluate(P.radiation_dose, 599.9, null).level).toBe("caution");
    expect(evaluate(P.radiation_dose, 600, null).level).toBe("critical");
  });
  it("temperature: fever at 38.0, caution band, hypothermia", () => {
    expect(evaluate(P.body_temp, 36.8, null).level).toBe("nominal");
    expect(evaluate(P.body_temp, 37.5, null).level).toBe("caution");
    expect(evaluate(P.body_temp, 38, null).level).toBe("critical");
    expect(evaluate(P.body_temp, 34.9, null).level).toBe("critical");
  });
  it("SpO2: 95 nominal, 94 caution, 89 critical", () => {
    expect(evaluate(P.spo2, 95, null).level).toBe("nominal");
    expect(evaluate(P.spo2, 94, null).level).toBe("caution");
    expect(evaluate(P.spo2, 90, null).level).toBe("caution");
    expect(evaluate(P.spo2, 89, null).level).toBe("critical");
  });
  it("z-score: within-threshold value still alerts when far from the personal baseline", () => {
    const base = computeBaseline(pre("resting_hr", [52, 54, 56]))!; // mean 54, sd 2
    expect(evaluate(P.resting_hr, 57, base).level).toBe("nominal");
    expect(evaluate(P.resting_hr, 58.5, base).level).toBe("caution"); // z = 2.25, still < 100 bpm
    const crit = evaluate(P.resting_hr, 62, base); // z = 4
    expect(crit.level).toBe("critical");
    expect(crit.reasons[0].en).toMatch(/personal baseline/);
  });
  it("z direction: a faster PVT or a lower heart rate is not an alert", () => {
    const pvt = computeBaseline(pre("pvt_rt", [250, 265, 280]))!;
    expect(evaluate(P.pvt_rt, 200, pvt).level).toBe("nominal");
    expect(evaluate(P.pvt_rt, 330, pvt).level).toBe("critical");
    const hrv = computeBaseline(pre("hrv", [57, 62, 67]))!;
    expect(evaluate(P.hrv, 90, hrv).level).toBe("nominal");
    expect(evaluate(P.hrv, 50, hrv).level).toBe("caution");
  });
  it("explains why it fired, cites the source and never diagnoses", () => {
    const al = alertFor(reading("body_temp", 38.6), null, mars)!;
    expect(al.level).toBe("critical");
    expect(al.explanation.en).toMatch(/critical limit of 38/);
    expect(al.explanation.en).toMatch(/Source: CDC/);
    expect(al.explanation.en).toMatch(/does not confirm a condition/);
    expect(al.explanation.es).toMatch(/médico de vuelo/);
    expect(alertFor(reading("body_temp", 36.6), null, mars)).toBeNull();
  });
});

describe("alert routing and communication delay", () => {
  it("fever, hypoxemia and contagion are immediate; others wait for the next link window", () => {
    expect(alertFor(reading("body_temp", 38.6), null, mars)!.immediate).toBe(true);
    expect(alertFor(reading("spo2", 87), null, mars)!.immediate).toBe(true);
    expect(alertFor(reading("crew_contagion", 1), null, mars)!.immediate).toBe(true);
    expect(alertFor(reading("sleep_hours", 5), null, mars)!.immediate).toBe(false);
    expect(alertFor(reading("body_temp", 37.6), null, mars)!.immediate).toBe(false);
  });
  it("Earth arrival = send time + one-way delay of the scenario", () => {
    const ts = 1_000_000;
    expect(earthArrival(ts, true, mars)).toBe(ts + 720_000);
    expect(earthArrival(ts, true, SCENARIO_BY_ID.iss)).toBe(ts + 500);
    const window = LINK_WINDOW_SEC * 1000;
    expect(earthArrival(ts, false, mars)).toBe(Math.ceil(ts / window) * window + 720_000);
    expect(earthArrival(window * 4, false, mars)).toBe(window * 4 + 720_000);
  });
  it("psychological findings alert the flight psychologist only (RNF-08)", () => {
    expect(recipientsFor(P.stress)).toEqual(["flight_psychologist"]);
    expect(alertFor(reading("stress", 9), null, mars)!.recipients).toEqual(["flight_psychologist"]);
    expect(recipientsFor(P.body_temp)).toContain("flight_surgeon");
    expect(recipientsFor(P.body_temp)).not.toContain("flight_psychologist");
  });
});

describe("verdict", () => {
  const st = (key: string, value: number) => ({ param: P[key], value, ts: 0, evaluation: evaluate(P[key], value, null), isSimulated: false });
  it("maps to Nominal / Caution / Critical alert = In range / Watch / Consult", () => {
    expect(computeVerdict([st("spo2", 98), st("body_temp", 36.6)]).level).toBe("nominal");
    expect(computeVerdict([st("spo2", 98), st("sleep_hours", 5)]).level).toBe("caution");
    const v = computeVerdict([st("sleep_hours", 5), st("spo2", 87)]);
    expect(v.level).toBe("critical");
    expect(v.drivers[0].param.key).toBe("spo2");
    expect(LEVEL_LABEL.nominal.verdict.es).toBe("En rango");
    expect(LEVEL_LABEL.caution.verdict.es).toBe("Vigilar");
    expect(LEVEL_LABEL.critical.verdict.es).toBe("Consultar");
    expect(LEVEL_LABEL.critical.status.es).toBe("Alerta crítica");
  });
  it("three nights under 6 h raise the verdict to Watch", () => {
    expect(sleepDebt([7, 5, 5.5, 5.9])).toBe(true);
    expect(sleepDebt([5, 5, 6])).toBe(false);
    expect(sleepDebt([5, 5])).toBe(false);
    expect(computeVerdict([st("spo2", 98)], [5.5, 5.2, 5.8]).level).toBe("caution");
  });
});

describe("seed and demo events", () => {
  const seed = seedReadings(mars, new Date("2026-11-14T20:00:00").getTime());
  it("gives every crew member 3 baseline sessions, 14 mission days and 14 post days", () => {
    for (const id of ["a1", "a2", "a3", "a4"]) {
      const s = seed[seriesKey(id, "resting_hr")];
      expect(s.filter((r) => r.phase === "pre")).toHaveLength(3);
      expect(s.filter((r) => r.phase === "mission")).toHaveLength(14);
      expect(s.filter((r) => r.phase === "post")).toHaveLength(14);
      expect(computeBaseline(s)).not.toBeNull();
    }
    expect(seed[seriesKey(HABITAT, "cabin_co2")].filter((r) => r.phase === "mission")).toHaveLength(14);
  });
  it("is deterministic and stays inside physical limits", () => {
    expect(seedReadings(mars, new Date("2026-11-14T20:00:00").getTime())).toEqual(seed);
    for (const s of Object.values(seed)) for (const r of s) expect(validateValue(r.parameter, r.value).ok).toBe(true);
  });
  it("starts with two storylines: Mateo's three short nights and Samuel's alert showcase; everyone else is nominal", () => {
    for (const [k, s] of Object.entries(seed)) {
      const last = s.filter((r) => r.phase === "mission").at(-1);
      if (!last) continue;
      const level = evaluate(P[last.parameter], last.value, computeBaseline(s)).level;
      if (k === "a2:sleep_hours" || (k.startsWith(`${ALERT_PROFILE_ID}:`) && ALERT_PROFILE[last.parameter] !== undefined)) expect(`${k}=${level}`).not.toBe(`${k}=nominal`);
      else expect(`${k}=${level}`).toBe(`${k}=nominal`);
    }
  });
  it("the alert showcase raises critical alerts in several body systems", () => {
    const crit = Object.entries(seed).filter(([k, s]) => {
      if (!k.startsWith(`${ALERT_PROFILE_ID}:`)) return false;
      const last = s.filter((r) => r.phase === "mission").at(-1)!;
      return evaluate(P[last.parameter], last.value, computeBaseline(s)).level === "critical";
    }).map(([k]) => k.split(":")[1]);
    for (const key of ["body_temp", "spo2", "glucose", "radiation_dose", "dose_30d_bfo", "crew_contagion", "bmd_vs_baseline"]) expect(crit).toContain(key);
  });
  it("demo events produce the expected alert levels", () => {
    const lvl = (r: Reading) => evaluate(P[r.parameter], r.value, null).level;
    expect(lvl(runDemoEvent("fever", "a1", 1).readings[0])).toBe("critical");
    expect(lvl(runDemoEvent("hypoxemia", "a1", 1).readings[0])).toBe("critical");
    expect(lvl(runDemoEvent("co2_spike", "a1", 1).readings[0])).toBe("critical");
    expect(runDemoEvent("solar_storm", "a1", 1).readings.map(lvl)).toEqual(["caution", "caution", "caution"]);
    expect(runDemoEvent("sleep_loss", "a3", 1).replaceLast!.values.every((h) => h < 6)).toBe(true);
    expect(runDemoEvent("fever", "a1", 1).readings.every((r) => r.isSimulated)).toBe(true);
  });
});
