import { describe, expect, it } from "vitest";
import { SCENARIO_BY_ID } from "@/lib/crew";
import { epiFor } from "@/lib/epi";
import { ALERT_PROFILE_ID, seedReadings } from "@/lib/simulator";
import { alteredOf, triageOf, type AppState } from "@/lib/store";
import { triage, type Getter } from "@/lib/triage";

const vals = (o: Record<string, number>, z: Record<string, number> = {}): Getter => (k) => (o[k] === undefined ? undefined : { value: o[k], z: z[k] ?? null });
const state = (): AppState => ({
  ready: true, lang: "es", role: "flight_surgeon", scenarioId: "mars", phase: "mission", astronautId: "a1", mode: "simple", demoMode: false,
  readings: seedReadings(SCENARIO_BY_ID.mars, new Date("2026-11-14T20:00:00").getTime()), alerts: [], effects: {}, events: [], rev: 0,
});

describe("IITT triage", () => {
  it("green when nothing is out of range", () => {
    expect(triage(vals({ resting_hr: 58, body_temp: 36.6, spo2: 98, glucose: 90 })).level).toBe("green");
  });
  it("step 3: high-risk vital signs (HR > 130, temp > 39, SpO2 < 92)", () => {
    expect(triage(vals({ resting_hr: 135 })).level).toBe("orange");
    expect(triage(vals({ body_temp: 39.2 })).level).toBe("orange");
    expect(triage(vals({ spo2: 91 })).level).toBe("orange");
  });
  it("a trained astronaut's resting HR under 60 is not high-risk unless far below their baseline", () => {
    expect(triage(vals({ resting_hr: 55 }, { resting_hr: -0.5 })).level).toBe("green");
    expect(triage(vals({ resting_hr: 55 }, { resting_hr: -2.5 })).level).toBe("orange");
  });
  it("step 2: yellow criteria", () => {
    expect(triage(vals({ nausea: 3 })).level).toBe("yellow");
    expect(triage(vals({ visual_symptoms: 2 })).level).toBe("yellow");
    expect(triage(vals({ rash: 1 })).level).toBe("yellow");
  });
  it("step 1: red criteria win over everything else", () => {
    expect(triage(vals({ resting_hr: 155 })).level).toBe("red");
    expect(triage(vals({ glucose: 50 })).level).toBe("red");
    expect(triage(vals({ body_temp: 38.4, headache: 2 })).level).toBe("red"); // two of: fever + headache
    expect(triage(vals({ body_temp: 38.4 })).level).toBe("green"); // fever alone is not red
    expect(triage(vals({ dose_30d_bfo: 260, nausea: 3 })).level).toBe("red");
  });
  it("the alert-showcase crew member is RED and everyone else is GREEN at first launch", () => {
    const s = state();
    expect(triageOf(s, ALERT_PROFILE_ID).level).toBe("red");
    for (const id of ["a1", "a2", "a3"]) expect(triageOf(s, id).level).toBe("green");
  });
});

describe("PPE (EPI) protocols", () => {
  it("contagion and fever trigger the infection protocol with crew risk", () => {
    const [p] = epiFor([{ key: "body_temp", level: "critical" }, { key: "crew_contagion", level: "critical" }]);
    expect(p.id).toBe("infection");
    expect(p.crewRisk).toBe(true);
    expect(p.ppe.length).toBeGreaterThan(0);
  });
  it("nothing altered = no protocol", () => {
    expect(epiFor([])).toEqual([]);
  });
  it("the alert-showcase profile triggers most protocols", () => {
    const altered = alteredOf(state(), ALERT_PROFILE_ID, { includePsych: true }).map((x) => ({ key: x.param.key, level: x.evaluation.level }));
    expect(epiFor(altered).length).toBeGreaterThanOrEqual(10);
  });
});
