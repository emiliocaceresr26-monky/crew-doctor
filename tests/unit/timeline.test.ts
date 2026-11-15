import { describe, expect, it } from "vitest";
import { SCENARIO_BY_ID } from "@/lib/crew";
import { ALERT_PROFILE_ID, seedReadings } from "@/lib/simulator";
import type { AppState } from "@/lib/store";
import { baselineOf, summarize, vitalTimeline } from "@/lib/timeline";

const state = (): AppState => ({
  ready: true, lang: "es", role: "flight_surgeon", scenarioId: "mars", phase: "mission", astronautId: "a1", mode: "simple", demoMode: false,
  readings: seedReadings(SCENARIO_BY_ID.mars, new Date("2026-11-14T20:00:00").getTime()), alerts: [], effects: {}, events: [], rev: 0,
});

describe("vital-sign timeline", () => {
  it("covers the three periods in order: 3 baseline sessions, 14 mission days, 14 recovery days", () => {
    const pts = vitalTimeline(state(), "a1", "resting_hr");
    expect(pts.filter((p) => p.phase === "pre")).toHaveLength(3);
    expect(pts.filter((p) => p.phase === "mission")).toHaveLength(14);
    expect(pts.filter((p) => p.phase === "post")).toHaveLength(14);
    expect(pts.map((p) => p.phase).join(",")).toMatch(/^(pre,)+(mission,)+(post,?)+$/);
    expect(pts.find((p) => p.phase === "mission")!.label.es).toBe(`D${SCENARIO_BY_ID.mars.missionDay - 13}`);
  });
  it("summarises each period; the alert-showcase profile is out of range in mission only", () => {
    const s = state();
    const sum = summarize(vitalTimeline(s, ALERT_PROFILE_ID, "resting_hr"), baselineOf(s, ALERT_PROFILE_ID, "resting_hr"));
    const mission = sum.find((x) => x.phase === "mission")!;
    expect(mission.worst).toBe("critical");
    expect(mission.outOfRange).toBeGreaterThan(0);
    expect(mission.max).toBe(134);
    expect(sum.find((x) => x.phase === "pre")!.outOfRange).toBe(0);
    expect(sum.find((x) => x.phase === "pre")!.deltaPct).toBeCloseTo(0, 5);
  });
});
