"use client";

import { useState } from "react";
import { ShieldAlert, Users } from "lucide-react";
import { CREW, CREW_BY_ID } from "@/lib/crew";
import { epiFor } from "@/lib/epi";
import { FEATURED, PARAM_BY_KEY } from "@/lib/parameters";
import { ALERT_PROFILE_ID, HABITAT, seriesKey } from "@/lib/simulator";
import { alteredOf, statusOf, store, triageOf } from "@/lib/store";
import { TRIAGE_COLOR, TRIAGE_LABEL, type TriageLevel } from "@/lib/triage";
import type { Lang, Level, Parameter } from "@/lib/types";
import { canSeePsych, ParamCard } from "./panels";
import { Glass, LEVEL_COLOR, LevelBadge, Sparkline, StatusIcon, useApp, useT } from "./ui";

const S = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);
const STEP: Record<1 | 2 | 3, { en: string; es: string }> = {
  1: { en: "Step 1 · red criterion", es: "Paso 1 · criterio rojo" },
  2: { en: "Step 2 · yellow criterion", es: "Paso 2 · criterio amarillo" },
  3: { en: "Step 3 · high-risk vital sign", es: "Paso 3 · signo vital de alto riesgo" },
};
const STEP_COLOR = { 1: TRIAGE_COLOR.red, 2: TRIAGE_COLOR.yellow, 3: TRIAGE_COLOR.orange } as const;

/** Vital signs shown to ground control for every crew member. */
export const VITAL_KEYS = ["resting_hr", "hrv", "spo2", "body_temp", "glucose", "effective_sleep"];

/** Plain-language status for a crew member who is not a clinician. */
export const PLAIN: Record<Level, { en: string; es: string }> = {
  nominal: { en: "All good", es: "Bien" },
  caution: { en: "Keep an eye on it", es: "Vigilar" },
  critical: { en: "Talk to the medical officer", es: "Avisa al oficial médico" },
};

export function TriageChip({ level }: { level: TriageLevel }) {
  const { tr } = useT();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: `${TRIAGE_COLOR[level]}26`, color: TRIAGE_COLOR[level] }} data-testid="triage-chip" data-triage={level}>
      <span className="size-2 rounded-full" style={{ background: TRIAGE_COLOR[level] }} />
      {tr(TRIAGE_LABEL[level].title)}
    </span>
  );
}

/** IITT triage result for one crew member: colour, disposition, on-board action and findings. */
/** Plain-language triage message for the crew member (no clinical jargon). */
const CREW_TRIAGE: Record<TriageLevel, { title: { en: string; es: string }; text: { en: string; es: string } }> = {
  red: { title: { en: "Get medical help now", es: "Pide ayuda médica ahora" }, text: { en: "Stop what you are doing and call the Crew Medical Officer. Mission control has been notified.", es: "Detén lo que estás haciendo y llama al Oficial Médico de la tripulación. El control en Tierra ya fue notificado." } },
  yellow: { title: { en: "See the medical officer today", es: "Consulta hoy al oficial médico" }, text: { en: "No EVA or critical tasks until you have been checked.", es: "Sin EVA ni tareas críticas hasta que te revisen." } },
  orange: { title: { en: "Repeat your measurements", es: "Repite tus mediciones" }, text: { en: "Some vital signs are off. Measure again now and tell the medical officer.", es: "Algunos signos vitales están alterados. Vuelve a medir ahora y avisa al oficial médico." } },
  green: { title: { en: "You are fit for duty", es: "Estás apto para tus tareas" }, text: { en: "Keep your normal schedule.", es: "Sigue tu rutina normal." } },
};

export function TriageCard({ subject, title, simple = false }: { subject: string; title?: string; simple?: boolean }) {
  const app = useApp();
  const { tr, lang } = useT();
  const res = triageOf(app, subject);
  const c = TRIAGE_COLOR[res.level];
  const label = TRIAGE_LABEL[res.level];
  if (simple) {
    const msg = CREW_TRIAGE[res.level];
    return (
      <Glass aria-label={S(lang, "Your status", "Tu estado")} data-testid="triage" data-triage={res.level} className="border-l-[6px]" style={{ borderLeftColor: c }}>
        <p className="eyebrow">{S(lang, "Your status today", "Tu estado hoy")}</p>
        <p className="display mt-1 text-[26px] font-bold leading-tight" style={{ color: c }} data-testid="triage-title">{tr(msg.title)}</p>
        <p className="mt-1 text-[14px] leading-snug text-soft">{tr(msg.text)}</p>
        {res.findings.length > 0 && (
          <>
            <p className="mt-3 text-[12px] font-semibold text-muted">{S(lang, "Why:", "Por qué:")}</p>
            <ul className="mt-1 list-disc pl-5 text-[13.5px]" data-testid="triage-reasons">
              {res.findings.slice(0, 3).map((f, i) => <li key={i}>{tr(f.evidence)}</li>)}
            </ul>
            {res.findings.length > 3 && <p className="mt-1 text-[12px] text-muted">+{res.findings.length - 3} {S(lang, "more, reviewed by mission control", "más, revisados por el control en Tierra")}</p>}
          </>
        )}
      </Glass>
    );
  }
  return (
    <Glass aria-label={S(lang, "Triage", "Triage")} data-testid="triage" data-triage={res.level} className="border-l-[6px]" style={{ borderLeftColor: c }}>
      <p className="eyebrow">{title ?? S(lang, "Triage (IITT · WHO / ICRC / MSF)", "Triage (IITT · OMS / CICR / MSF)")}</p>
      <p className="display mt-1 text-[24px] font-bold leading-tight" style={{ color: c }} data-testid="triage-title">{tr(label.title)}</p>
      <p className="mt-1 text-[13.5px] font-semibold">{tr(label.disposition)}</p>
      <p className="mt-1 text-[13px] leading-snug text-soft">{tr(label.space)}</p>
      {res.findings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" data-testid="triage-findings">
          {res.findings.map((f, i) => (
            <li key={i} className="rounded-[12px] border border-line px-3 py-2 text-[13px]">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: STEP_COLOR[f.step] }}>{tr(STEP[f.step])}{f.adapted ? S(lang, " · space adaptation", " · adaptación espacial") : ""}</span>
              <span className="block font-medium">{tr(f.criterion)}</span>
              <span className="block text-[12px] text-muted">{tr(f.evidence)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11.5px] leading-snug text-muted">
        {S(lang, "Not measured on board: ", "No medido a bordo: ")}{res.notMeasured.map((x) => tr(x)).join("; ")}. {S(lang, "Decision support only; confirm with the Crew Medical Officer / flight surgeon.", "Solo apoyo a la decisión; confirmar con el Oficial Médico / médico de vuelo.")}
      </p>
    </Glass>
  );
}

/** Ground view: every vital sign of every crew member, with trend, in one table. */
export function CrewVitalsTable({ onOpen }: { onOpen: (key: string) => void }) {
  const app = useApp();
  const { tr, n, lang } = useT();
  return (
    <Glass aria-label={S(lang, "Vital signs", "Signos vitales")} data-testid="vitals">
      <h2 className="eyebrow mb-2">{S(lang, "Vital signs · whole crew", "Signos vitales · toda la tripulación")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="text-muted">
            <tr>
              <th className="py-1.5 pr-2 font-medium">{S(lang, "Crew member", "Tripulante")}</th>
              {VITAL_KEYS.map((k) => (
                <th key={k} className="pr-2 font-medium">
                  <button type="button" className="cursor-pointer text-left underline decoration-white/25 underline-offset-4 hover:decoration-accent" onClick={() => onOpen(k)}>{tr(PARAM_BY_KEY[k].name)}</button>
                </th>
              ))}
              <th className="font-medium">{S(lang, "Resp. rate", "Frec. respiratoria")}</th>
            </tr>
          </thead>
          <tbody>
            {CREW.map((a) => (
              <tr key={a.id} className={`border-t border-white/10 ${a.id === app.astronautId ? "bg-accent/10" : ""}`} data-testid={`vitals-${a.id}`}>
                <td className="py-2 pr-2">
                  <button type="button" onClick={() => store.setAstronaut(a.id)} className="cursor-pointer text-left font-semibold hover:text-accent">{a.name}</button>
                </td>
                {VITAL_KEYS.map((k) => {
                  const p = PARAM_BY_KEY[k];
                  const s = statusOf(app, a.id, p);
                  const lvl = s?.evaluation.level ?? "nominal";
                  const trend = (app.readings[seriesKey(p.scope === "habitat" ? HABITAT : a.id, k)] ?? []).filter((r) => r.phase === app.phase).slice(-14).map((r) => r.value);
                  return (
                    <td key={k} className="pr-2 align-middle" data-level={lvl}>
                      {s ? (
                        <span className="flex flex-col">
                          <span className="flex items-center gap-1.5 font-semibold" style={{ color: lvl === "nominal" ? undefined : LEVEL_COLOR[lvl] }}>
                            <StatusIcon level={lvl} size={11} />{n(s.value, p.sim?.decimals)} <span className="text-[11px] font-normal text-muted">{p.unit}</span>
                          </span>
                          <Sparkline values={trend} color={LEVEL_COLOR[lvl]} width={84} height={20} />
                        </span>
                      ) : "—"}
                    </td>
                  );
                })}
                <td className="text-[12px] text-muted">{S(lang, "not measured", "no medida")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Glass>
  );
}

/** Astronaut view: the key parameters in plain language (status word first, number second). */
export function SimpleKeyParams({ onOpen }: { onOpen: (key: string) => void }) {
  const app = useApp();
  const { lang } = useT();
  const list = FEATURED.filter((p) => p.phases.includes(app.phase));
  return (
    <section aria-label={S(lang, "Key parameters", "Parámetros clave")} data-testid="key-params">
      <h2 className="eyebrow mb-2 px-1">{S(lang, "Your key parameters", "Tus parámetros clave")}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {list.map((p) => <SimpleParamCard key={p.key} param={p} onOpen={onOpen} />)}
      </div>
    </section>
  );
}

function SimpleParamCard({ param, onOpen }: { param: Parameter; onOpen: (key: string) => void }) {
  const app = useApp();
  const { tr, n, lang } = useT();
  const s = statusOf(app, app.astronautId, param);
  const lvl: Level = s?.evaluation.level ?? "nominal";
  return (
    <button type="button" onClick={() => onOpen(param.key)} data-testid={`card-${param.key}`} data-level={lvl}
      className="glass flex min-h-[112px] cursor-pointer flex-col justify-between gap-2 p-4 text-left hover:border-accent/50"
      style={lvl === "nominal" ? undefined : { borderColor: `${LEVEL_COLOR[lvl]}80` }}>
      <span className="text-[13.5px] font-medium leading-snug text-soft">{tr(param.name)}</span>
      <span className="flex items-center gap-2 text-[17px] font-bold leading-tight" style={{ color: LEVEL_COLOR[lvl] }}>
        <StatusIcon level={lvl} size={16} />{tr(PLAIN[lvl])}
      </span>
      <span className="text-[12.5px] text-muted">{s ? `${n(s.value, param.sim?.decimals)} ${param.unit}` : "—"} · {S(lang, "tap for what it means", "toca para saber qué significa")}</span>
    </button>
  );
}

/** PPE (EPI) and actions for every symptom or reading that is out of range. */
export function EpiPanel({ subject, simple = false }: { subject: string; simple?: boolean }) {
  const app = useApp();
  const { tr, lang } = useT();
  const [all, setAll] = useState(false);
  const altered = alteredOf(app, subject, { includePsych: true }).map((s) => ({ key: s.param.key, level: s.evaluation.level }));
  const full = epiFor(altered);
  // The crew member sees the 3 most urgent protocols first; ground control sees all of them.
  const list = simple && !all ? full.slice(0, 3) : full;
  return (
    <Glass aria-label={S(lang, "PPE and actions", "EPI y acciones")} data-testid="epi">
      <h2 className="display flex items-center gap-2 text-[16px] font-semibold"><ShieldAlert size={18} aria-hidden="true" />{S(lang, "PPE and actions to take", "EPI y acciones a tomar")}</h2>
      {list.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-soft">{S(lang, "No symptoms that require PPE. Standard hygiene: wash hands and keep your personal dosimeter on.", "Sin síntomas que requieran EPI. Higiene estándar: lávate las manos y mantén tu dosímetro puesto.")}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5">
          {list.map((p) => (
            <li key={p.id} className="rounded-[14px] border p-3" style={{ borderColor: `${LEVEL_COLOR[p.level]}66` }} data-testid={`epi-${p.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14.5px] font-semibold">{tr(p.title)}</span>
                <span className="flex items-center gap-2">
                  {p.crewRisk && <span className="inline-flex items-center gap-1 rounded-full border border-crit/50 px-2 py-0.5 text-[11px] font-semibold text-crit"><Users size={12} aria-hidden="true" />{S(lang, "Crew risk", "Riesgo para la tripulación")}</span>}
                  <LevelBadge level={p.level} />
                </span>
              </div>
              {!simple && <p className="mt-0.5 text-[11.5px] text-muted">{S(lang, "Because of: ", "Por: ")}{p.causes.map((k) => tr(PARAM_BY_KEY[k].name)).join(", ")}</p>}
              {p.ppe.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-accent">{S(lang, "PPE", "EPI")}</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">{p.ppe.map((x) => <li key={x.en} className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[12px]">{tr(x)}</li>)}</ul>
                </div>
              )}
              <div className="mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-soft">{S(lang, "What to do", "Qué hacer")}</p>
                <ul className="mt-1 list-disc pl-5 text-[13px] leading-snug">{p.actions.map((x) => <li key={x.en}>{tr(x)}</li>)}</ul>
              </div>
              {p.protectCrew.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-soft">{S(lang, "Protect the crew", "Proteger a la tripulación")}</p>
                  <ul className="mt-1 list-disc pl-5 text-[13px] leading-snug">{p.protectCrew.map((x) => <li key={x.en}>{tr(x)}</li>)}</ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {simple && full.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-10 cursor-pointer rounded-[12px] border border-line px-3 text-[13px] font-medium hover:bg-white/5" data-testid="epi-more">
          {all ? S(lang, "Show less", "Ver menos") : S(lang, `Show all (${full.length})`, `Ver todas (${full.length})`)}
        </button>
      )}
      <p className="mt-3 text-[11.5px] text-muted">{S(lang, "General guidance; no diagnosis or medication. To be validated by the flight surgeon.", "Orientación general; no diagnostica ni indica medicamentos. Por validar con el médico de vuelo.")}</p>
    </Glass>
  );
}

/** Monitoring shown to the crew member ONLY for parameters that are out of range. */
export function AlteredMonitor({ subject, onOpen, exclude = [], simple = false }: { subject: string; onOpen: (key: string) => void; exclude?: string[]; simple?: boolean }) {
  const app = useApp();
  const { tr, lang } = useT();
  const [all, setAll] = useState(false);
  const list = alteredOf(app, subject, { includePsych: canSeePsych(app.role) }).filter((s) => !exclude.includes(s.param.key));
  if (simple) {
    // Plain list, most urgent first, no numbers or charts: the crew member is not a clinician.
    const shown = all ? list : list.slice(0, 5);
    return (
      <Glass aria-label={S(lang, "Monitoring", "Monitoreo")} data-testid="altered">
        <h2 className="eyebrow">{S(lang, "Other things to watch", "Otras cosas a vigilar")} · {list.length}</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-soft">{S(lang, "Nothing else is out of range.", "Nada más está fuera de rango.")}</p>
        ) : (
          <>
            <ul className="mt-2 flex flex-col">
              {shown.map((s) => (
                <li key={s.param.key} className="border-t border-white/10 first:border-t-0">
                  <button type="button" onClick={() => onOpen(s.param.key)} className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-2 text-left hover:text-accent">
                    <span className="text-[14px]">{tr(s.param.name)}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: LEVEL_COLOR[s.evaluation.level] }}>
                      <StatusIcon level={s.evaluation.level} size={12} />{tr(PLAIN[s.evaluation.level])}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {list.length > 5 && (
              <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-10 cursor-pointer rounded-[12px] border border-line px-3 text-[13px] font-medium hover:bg-white/5">
                {all ? S(lang, "Show less", "Ver menos") : S(lang, `Show all (${list.length})`, `Ver todos (${list.length})`)}
              </button>
            )}
          </>
        )}
      </Glass>
    );
  }
  return (
    <section aria-label={S(lang, "Monitoring", "Monitoreo")} data-testid="altered">
      <h2 className="eyebrow mb-2 px-1">{S(lang, "Monitoring · only altered parameters", "Monitoreo · solo parámetros alterados")} · {list.length}</h2>
      {list.length === 0 ? (
        <Glass><p className="text-[13.5px] text-soft">{S(lang, "All your other parameters are within range. Nothing to monitor right now.", "Todos tus demás parámetros están en rango. Nada que monitorear por ahora.")}</p></Glass>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {list.map((s) => <ParamCard key={s.param.key} param={s.param} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}

/** Ground view: triage colour of every crew member at a glance. Click selects the crew member. */
export function CrewTriageBoard() {
  const app = useApp();
  const { tr, lang } = useT();
  return (
    <Glass aria-label={S(lang, "Crew triage", "Triage de la tripulación")} data-testid="crew-triage">
      <p className="eyebrow mb-2">{S(lang, "Crew triage (IITT)", "Triage de la tripulación (IITT)")}</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CREW.map((a) => {
          const res = triageOf(app, a.id);
          const altered = alteredOf(app, a.id, { includePsych: canSeePsych(app.role) }).length;
          const on = a.id === app.astronautId;
          return (
            <li key={a.id}>
              <button type="button" onClick={() => store.setAstronaut(a.id)} aria-pressed={on} data-testid={`triage-${a.id}`} data-triage={res.level}
                className={`flex w-full cursor-pointer flex-col gap-1 rounded-[14px] border border-l-[6px] p-3 text-left ${on ? "bg-accent/15" : "hover:bg-white/5"}`}
                style={{ borderLeftColor: TRIAGE_COLOR[res.level], borderColor: on ? undefined : "rgba(255,255,255,0.12)" }}>
                <span className="text-[14px] font-semibold">{a.name}</span>
                <span className="text-[12px] text-muted">{tr(a.role)}{a.id === ALERT_PROFILE_ID ? ` · ${S(lang, "alert simulation", "simulación de alertas")}` : ""}</span>
                <TriageChip level={res.level} />
                <span className="text-[12px] text-soft">{res.findings.length} {S(lang, "triage findings", "hallazgos de triage")} · {altered} {S(lang, "altered parameters", "parámetros alterados")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-muted">{S(lang, "Selected: ", "Seleccionado: ")}{CREW_BY_ID[app.astronautId]?.name}</p>
    </Glass>
  );
}
