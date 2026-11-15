"use client";

import { useEffect, useState } from "react";
import { Glass, LEVEL_COLOR, LevelBadge, StatusIcon, useApp, useT } from "@/components/ui";
import { CREW, CREW_BY_ID, formatDelay, SCENARIO_BY_ID } from "@/lib/crew";
import { PARAM_BY_KEY } from "@/lib/parameters";
import { HABITAT } from "@/lib/simulator";
import { TriageChip } from "@/components/health";
import { triageOf, verdictOf } from "@/lib/store";

/** Demo acceleration options: 12 real minutes would not fit in an 80-second demo. */
const SPEEDS = [1, 10, 60];

/**
 * Mission control on Earth (RF-20, RF-21). Alerts become visible here only after the link
 * window plus the one-way delay of the scenario. Psychological alerts never reach the flight
 * surgeon: they are routed to the flight psychologist only.
 */
export default function ControlPage() {
  const app = useApp();
  const { t, tr, n, lang } = useT();
  const [speed, setSpeed] = useState(60);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);

  const scenario = SCENARIO_BY_ID[app.scenarioId];
  const earthRole = app.role === "flight_psychologist" ? "flight_psychologist" : "flight_surgeon";
  const alerts = app.alerts.filter((a) => a.recipients.includes(earthRole));
  // Accelerated clock: remaining transit time shrinks `speed` times faster than real time.
  const arrival = (a: { ts: number; earthArrivalTs: number }) => a.ts + (a.earthArrivalTs - a.ts) / speed;
  const inTransit = alerts.filter((a) => arrival(a) > now);
  const received = alerts.filter((a) => arrival(a) <= now);
  const L = (en: string, es: string) => (lang === "es" ? es : en);

  return (
    <div className="flex flex-col gap-3" data-testid="control">
      <Glass>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{L("Mission control · Earth", "Centro de control · Tierra")} · {t(earthRole === "flight_psychologist" ? "role_flight_psychologist" : "role_flight_surgeon")}</p>
            <h1 className="display mt-1 text-2xl font-semibold">{tr(scenario.name)}</h1>
            <p className="mt-1 text-[13.5px] text-soft" data-testid="control-delay">
              {L("One-way delay", "Retraso de ida")}: <strong>{formatDelay(scenario.delaySec, lang)}</strong> · {L("round trip", "ida y vuelta")}: <strong>{formatDelay(scenario.delaySec * 2, lang)}</strong> · {n(scenario.distanceKm, 0)} km
            </p>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            {L("Demo time acceleration", "Aceleración de tiempo (demo)")}
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} data-testid="speed">
              {SPEEDS.map((s) => <option key={s} value={s}>×{s}</option>)}
            </select>
          </label>
        </div>
      </Glass>

      <div className="grid gap-3 lg:grid-cols-2">
        <Glass data-testid="in-transit">
          <h2 className="eyebrow">{L("In transit to Earth", "En tránsito hacia la Tierra")} · {inTransit.length}</h2>
          {inTransit.length === 0 ? <p className="mt-2 text-[13.5px] text-soft">{L("Nothing in transit.", "Nada en tránsito.")}</p> : (
            <ul className="mt-2 flex flex-col gap-2">
              {inTransit.map((a) => {
                const total = arrival(a) - a.ts;
                const left = Math.max(0, arrival(a) - now);
                return (
                  <li key={a.id} className="rounded-[14px] border border-line p-3" data-testid={`transit-${a.parameter}`}>
                    <div className="flex items-center justify-between gap-2 text-[14px] font-semibold">
                      <span className="flex items-center gap-2"><StatusIcon level={a.level} />{tr(PARAM_BY_KEY[a.parameter].name)}</span>
                      <span className="text-[12.5px] text-muted">{a.immediate ? t("immediate") : t("nextLink")} · {Math.ceil(left / 1000)} s</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (1 - left / total) * 100)}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Glass>

        <Glass data-testid="received">
          <h2 className="eyebrow">{L("Received on Earth", "Recibido en Tierra")} · {received.length}</h2>
          {received.length === 0 ? <p className="mt-2 text-[13.5px] text-soft">{L("No alerts received yet.", "Aún no se reciben alertas.")}</p> : (
            <ul className="mt-2 flex flex-col gap-2">
              {received.slice(0, 8).map((a) => (
                <li key={a.id} className="rounded-[14px] border p-3" style={{ borderColor: `${LEVEL_COLOR[a.level]}66` }} data-testid={`received-${a.parameter}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] font-semibold">
                    <span className="flex items-center gap-2"><StatusIcon level={a.level} />{tr(PARAM_BY_KEY[a.parameter].name)} · {a.subject === HABITAT ? t("habitat") : CREW_BY_ID[a.subject]?.name}</span>
                    <LevelBadge level={a.level} />
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-soft">{tr(a.explanation)}</p>
                </li>
              ))}
            </ul>
          )}
        </Glass>
      </div>

      <Glass data-testid="control-crew">
        <h2 className="eyebrow">{t("crewStatus")}</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CREW.map((a) => {
            const v = verdictOf(app, a.id, { includePsych: earthRole === "flight_psychologist" });
            return (
              <li key={a.id} className="rounded-[14px] border border-line p-3">
                <p className="flex items-center gap-2 text-[14px] font-semibold"><StatusIcon level={v.level} size={16} />{a.name}</p>
                <p className="mt-0.5 text-[12px] text-muted">{tr(a.role)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2"><LevelBadge level={v.level} kind="verdict" /><TriageChip level={triageOf(app, a.id).level} /></p>
                <p className="mt-1 text-[12px] leading-snug text-soft">{v.drivers.slice(0, 3).map((d) => tr(d.param.name)).join(", ") || "—"}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[12px] text-muted">
          {L("Data shown here is what the last received packet contained. Raw metrics travel in the background; psychological findings go only to the flight psychologist.",
            "Lo que se muestra aquí es el contenido del último paquete recibido. Las métricas crudas viajan en segundo plano; los hallazgos psicológicos van solo al psicólogo de vuelo.")}
        </p>
      </Glass>
    </div>
  );
}
