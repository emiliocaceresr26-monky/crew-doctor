"use client";

import { useState } from "react";
import { CrewTriageBoard, CrewVitalsTable, EpiPanel, TriageCard } from "@/components/health";
import { ParamDetail } from "@/components/ParamDetail";
import { AlertsPanel, AllParams, EventLog, KeyParams, MissionTimeline, SimulatePanel } from "@/components/panels";
import { Glass, useApp, useT } from "@/components/ui";
import { CREW_BY_ID } from "@/lib/crew";
import { BASELINE_SESSIONS } from "@/lib/engine";
import { seriesKey } from "@/lib/simulator";

/**
 * Ground (administrator) view: complete monitoring for the people watching from Earth.
 * Crew triage board, the selected crew member's triage, PPE status, key parameters,
 * alerts, simulation panel and the full parameter table.
 */
export default function DashboardPage() {
  const app = useApp();
  const { t, lang } = useT();
  const [detail, setDetail] = useState<string | null>(null);
  const sessions = (app.readings[seriesKey(app.astronautId, "resting_hr")] ?? []).filter((r) => r.phase === "pre" && !r.excludedFromBaseline).length;
  const who = CREW_BY_ID[app.astronautId]?.name ?? "";

  return (
    <div className="flex flex-col gap-3" data-testid="dashboard" data-phase={app.phase}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <MissionTimeline />
        <CrewTriageBoard />
      </div>

      {app.phase === "pre" && (
        <Glass data-testid="baseline-progress">
          <p className="eyebrow">{t("baselineProgress")}</p>
          <p className="display mt-1 text-2xl font-semibold">{Math.min(sessions, BASELINE_SESSIONS)} / {BASELINE_SESSIONS}</p>
          <p className="mt-1 text-[13px] text-soft">{t("phaseHint_pre")}</p>
        </Glass>
      )}
      {app.phase === "post" && (
        <Glass data-testid="recovery-note">
          <p className="eyebrow">{t("recovery")}</p>
          <p className="mt-1 text-[13px] text-soft">{t("phaseHint_post")}</p>
        </Glass>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <TriageCard subject={app.astronautId} title={`${lang === "es" ? "Triage" : "Triage"} · ${who}`} />
        <EpiPanel subject={app.astronautId} />
      </div>

      <CrewVitalsTable onOpen={setDetail} />
      <KeyParams onOpen={setDetail} />

      <div className="grid gap-3 lg:grid-cols-2">
        <AlertsPanel onOpen={setDetail} limit={10} />
        <div className="flex flex-col gap-3">
          {app.phase === "mission" && <SimulatePanel />}
          <EventLog />
        </div>
      </div>

      <AllParams onOpen={setDetail} />
      <ParamDetail paramKey={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
