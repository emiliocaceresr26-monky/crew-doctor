"use client";

import { CREW, CREW_BY_ID, formatDelay, SCENARIO_BY_ID } from "@/lib/crew";
import { rank } from "@/lib/engine";
import type { DictKey } from "@/lib/i18n";
import { FEATURED, PARAM_BY_KEY, PARAMETERS } from "@/lib/parameters";
import { DEMO_EVENTS, HABITAT, seriesKey } from "@/lib/simulator";
import { statusOf, store, verdictOf, visibleAlerts, type AppState } from "@/lib/store";
import type { Level, Parameter, Role } from "@/lib/types";
import { Glass, LEVEL_COLOR, LevelBadge, SimBadge, Sparkline, StatusIcon, useApp, useT } from "./ui";

/** Psychological values are shown only to the crew member (own data) and the flight psychologist. */
export const canSeePsych = (role: Role) => role === "astronaut" || role === "flight_psychologist";

export function MissionTimeline() {
  const app = useApp();
  const { t, tr, n, lang } = useT();
  const s = SCENARIO_BY_ID[app.scenarioId];
  const pct = Math.min(100, (s.missionDay / s.missionLength) * 100);
  return (
    <Glass aria-label={t("timeline")} data-testid="timeline">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">{t("timeline")} · {tr(s.name)}</p>
        <p className="text-[12.5px] text-soft">{t(`phaseHint_${app.phase}` as DictKey)}</p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="display text-2xl font-semibold" data-testid="mission-day">{t("missionDay")} {s.missionDay}</span>
        <span className="text-[13px] text-muted">{t("of")} {s.missionLength}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={s.missionLength} aria-valuenow={s.missionDay} aria-label={t("missionDay")}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
        <div><dt className="text-muted">{t("distance")}</dt><dd className="font-semibold" data-testid="distance">{n(s.distanceKm, 0)} km</dd></div>
        <div><dt className="text-muted">{t("earthLink")}</dt><dd className="font-semibold" data-testid="delay">{formatDelay(s.delaySec, lang)}</dd></div>
      </dl>
    </Glass>
  );
}

export function CrewStrip() {
  const app = useApp();
  const { t, tr } = useT();
  return (
    <Glass aria-label={t("crewStatus")} data-testid="crew-strip">
      <p className="eyebrow mb-2">{t("crewStatus")}</p>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {CREW.map((a) => {
          const level = verdictOf(app, a.id, { includePsych: false }).level;
          const on = a.id === app.astronautId;
          return (
            <li key={a.id}>
              <button type="button" onClick={() => store.setAstronaut(a.id)} aria-pressed={on} data-testid={`crew-${a.id}`} data-level={level}
                className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[14px] border px-3 text-left ${on ? "border-accent/60 bg-accent/15" : "border-line hover:bg-white/5"}`}>
                <StatusIcon level={level} size={18} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-semibold">{a.name}</span>
                  <span className="truncate text-[12px] text-muted">{tr(a.role)} · <LevelBadgeText level={level} /></span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Glass>
  );
}

function LevelBadgeText({ level }: { level: Level }) {
  const { lang } = useT();
  const txt = { nominal: { en: "In range", es: "En rango" }, caution: { en: "Watch", es: "Vigilar" }, critical: { en: "Consult", es: "Consultar" } }[level][lang];
  return <span style={{ color: LEVEL_COLOR[level] }}>{txt}</span>;
}

function sparkValues(app: AppState, param: Parameter): number[] {
  const subject = param.scope === "habitat" ? HABITAT : app.astronautId;
  return (app.readings[seriesKey(subject, param.key)] ?? []).filter((r) => r.phase === app.phase).slice(-40).map((r) => r.value);
}

export function ParamCard({ param, onOpen }: { param: Parameter; onOpen: (key: string) => void }) {
  const app = useApp();
  const { t, tr, n } = useT();
  const hidden = param.psych && !canSeePsych(app.role);
  const status = hidden ? null : statusOf(app, app.astronautId, param);
  const level = status?.evaluation.level ?? "nominal";
  return (
    <button type="button" onClick={() => onOpen(param.key)} data-testid={`card-${param.key}`} data-level={level}
      className="glass flex min-h-[148px] cursor-pointer flex-col justify-between p-4 text-left hover:border-accent/50">
      <span className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium leading-snug text-soft">{tr(param.name)}</span>
        <StatusIcon level={level} size={16} />
      </span>
      {status ? (
        <>
          <span className="display mt-1 text-[34px] font-bold leading-none" style={{ color: level === "nominal" ? "#F2F5FA" : LEVEL_COLOR[level] }} data-testid={`value-${param.key}`}>
            {n(status.value, param.sim?.decimals)} <span className="text-[13px] font-medium text-muted">{param.unit}</span>
          </span>
          <span className="mt-1 flex items-end justify-between gap-2">
            <span className="flex flex-col gap-1"><LevelBadge level={level} /><SimBadge simulated={status.isSimulated} /></span>
            <Sparkline values={sparkValues(app, param)} color={LEVEL_COLOR[level]} />
          </span>
        </>
      ) : (
        <span className="text-[13px] text-muted">{hidden ? t("hiddenPsych") : "—"}</span>
      )}
    </button>
  );
}

export function KeyParams({ onOpen }: { onOpen: (key: string) => void }) {
  const app = useApp();
  const { t } = useT();
  const list = FEATURED.filter((p) => p.phases.includes(app.phase));
  return (
    <section aria-label={t("keyParams")}>
      <h2 className="eyebrow mb-2 px-1">{t("keyParams")}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="key-params">
        {list.map((p) => <ParamCard key={p.key} param={p} onOpen={onOpen} />)}
      </div>
    </section>
  );
}

export function AllParams({ onOpen }: { onOpen: (key: string) => void }) {
  const app = useApp();
  const { t, tr, n } = useT();
  const rows = PARAMETERS.filter((p) => p.kind !== "text" && p.origin !== "calculated" && p.phases.includes(app.phase));
  return (
    <Glass aria-label={t("allParams")} data-testid="all-params">
      <h2 className="eyebrow mb-2">{t("allParams")} · {rows.length}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="text-muted"><tr><th className="py-1.5 pr-2 font-medium">#</th><th className="pr-2 font-medium">{t("parameter")}</th><th className="pr-2 font-medium">{t("value")}</th><th className="pr-2 font-medium">{t("status")}</th><th className="pr-2 font-medium">{t("origin")}</th><th className="font-medium" /></tr></thead>
          <tbody>
            {rows.map((p) => {
              const hidden = p.psych && !canSeePsych(app.role);
              const s = hidden ? null : statusOf(app, app.astronautId, p);
              return (
                <tr key={p.key} className="border-t border-white/10" data-testid={`row-${p.key}`} data-simulated={s ? String(s.isSimulated) : undefined}>
                  <td className="py-2 pr-2 text-muted">{p.n}</td>
                  <td className="pr-2"><button type="button" className="cursor-pointer text-left underline decoration-white/25 underline-offset-4 hover:decoration-accent" onClick={() => onOpen(p.key)}>{tr(p.name)}</button></td>
                  <td className="pr-2 font-semibold">{s ? `${n(s.value, p.sim?.decimals)} ${p.unit}` : hidden ? "•••" : "—"}</td>
                  <td className="pr-2">{s ? <LevelBadge level={s.evaluation.level} /> : null}</td>
                  <td className="pr-2 text-muted">{tr(p.sourceLabel)}</td>
                  <td>{s ? <SimBadge simulated={s.isSimulated} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Glass>
  );
}

export function AlertsPanel({ onOpen, limit = 6 }: { onOpen?: (key: string) => void; limit?: number }) {
  const app = useApp();
  const { t, tr, n, lang } = useT();
  const all = visibleAlerts(app);
  const active = all.filter((a) => !a.acknowledged).sort((a, b) => rank(b.level) - rank(a.level) || b.ts - a.ts);
  const scenario = SCENARIO_BY_ID[app.scenarioId];
  return (
    <Glass aria-label={t("alerts")} data-testid="alerts">
      <div className="flex items-baseline justify-between"><h2 className="eyebrow">{t("alerts")}</h2><span className="text-[12px] text-muted" data-testid="alert-count">{active.length}</span></div>
      <div aria-live="assertive" className="sr-only">{active[0] ? tr(active[0].explanation) : ""}</div>
      {active.length === 0 ? <p className="mt-2 text-[13.5px] text-soft">{t("noAlerts")}</p> : (
        <ul className="mt-2 flex flex-col gap-2">
          {active.slice(0, limit).map((a) => {
            const p = PARAM_BY_KEY[a.parameter];
            const who = a.subject === HABITAT ? t("habitat") : CREW_BY_ID[a.subject]?.name;
            return (
              <li key={a.id} className="rounded-[14px] border p-3" style={{ borderColor: `${LEVEL_COLOR[a.level]}66` }} data-testid={`alert-${a.parameter}`} data-level={a.level}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[14px] font-semibold"><StatusIcon level={a.level} size={15} />{tr(p.name)} · {n(a.value, p.sim?.decimals)} {p.unit}</span>
                  <LevelBadge level={a.level} />
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  {who} · {new Date(a.ts).toLocaleTimeString(lang === "es" ? "es-CL" : "en-US", { hour: "2-digit", minute: "2-digit" })} · {a.immediate ? t("immediate") : t("nextLink")} · {t("earthLink")} +{formatDelay(scenario.delaySec, lang)}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-soft" data-testid="alert-explanation">{tr(a.explanation)}</p>
                <div className="mt-2 flex gap-2">
                  {onOpen && <button type="button" onClick={() => onOpen(a.parameter)} className="min-h-10 cursor-pointer rounded-[12px] border border-line px-3 text-[13px] font-medium hover:bg-white/5">{t("whatMeans")}</button>}
                  <button type="button" onClick={() => store.acknowledge(a.id)} className="min-h-10 cursor-pointer rounded-[12px] bg-fg px-3 text-[13px] font-semibold text-bg">{t("acknowledge")}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Glass>
  );
}

export function SimulatePanel() {
  const { t, tr } = useT();
  return (
    <Glass aria-label={t("simulateEvent")} data-testid="simulate" className="no-print">
      <h2 className="eyebrow">{t("simulateEvent")}</h2>
      <p className="mt-1 text-[12.5px] text-muted">{t("simulateHint")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEMO_EVENTS.map((e) => (
          <button key={e.id} type="button" onClick={() => store.simulateEvent(e.id, e.name)} data-testid={`event-${e.id}`}
            className="flex min-h-14 cursor-pointer flex-col justify-center rounded-[14px] border border-line px-3 text-left hover:border-accent/50 hover:bg-white/5">
            <span className="text-[13.5px] font-semibold">{tr(e.name)}</span>
            <span className="text-[11.5px] leading-snug text-muted">{tr(e.detail)}</span>
          </button>
        ))}
        <button type="button" onClick={() => store.resetEvents()} data-testid="event-reset" className="min-h-14 cursor-pointer rounded-[14px] border border-dashed border-line px-3 text-[13.5px] font-medium text-soft hover:bg-white/5">{t("reset")}</button>
      </div>
    </Glass>
  );
}

export function EventLog() {
  const app = useApp();
  const { t, tr, lang } = useT();
  if (!app.events.length) return null;
  return (
    <Glass aria-label={t("events")} data-testid="event-log">
      <h2 className="eyebrow">{t("events")}</h2>
      <ul className="mt-2 space-y-1 text-[13px] text-soft">
        {app.events.slice(0, 6).map((e) => (
          <li key={e.id}><span className="text-muted">{new Date(e.ts).toLocaleTimeString(lang === "es" ? "es-CL" : "en-US")}</span> · {tr(e.label)}</li>
        ))}
      </ul>
    </Glass>
  );
}
