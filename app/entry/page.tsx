"use client";

import { useState } from "react";
import { Glass, Segmented, useApp, useT } from "@/components/ui";
import { PARAM_BY_KEY } from "@/lib/parameters";
import { store } from "@/lib/store";
import type { L10n } from "@/lib/types";

/** Fields offered in the manual form. Any numeric parameter of the catalogue could be added here. */
const MANUAL = ["sleep_hours", "kss", "fatigue_sp", "body_temp", "spo2", "resting_hr", "water_intake", "urine_color", "headache", "nausea", "exercise_minutes", "mood"];
type Tab = "manual" | "sensors" | "visual";

/** Multimodal data entry (RF-03): manual, simulated sensor sync, visual (camera, legacy check). */
export default function EntryPage() {
  const app = useApp();
  const { t, tr } = useT();
  const [tab, setTab] = useState<Tab>("manual");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, L10n>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [oneOff, setOneOff] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, L10n> = {};
    const ok: string[] = [];
    for (const key of MANUAL) {
      const raw = values[key];
      if (raw === undefined || raw.trim() === "") continue;
      // Same validation and alert engine as every other source (RNF-05).
      const err = store.submit({ parameter: key, value: raw, source: "manual", excludedFromBaseline: oneOff });
      if (err) errs[key] = err; else ok.push(key);
    }
    setErrors(errs);
    setSaved(ok);
    setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => errs[k])));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3" data-testid="entry">
      <Segmented label={t("navEntry")} value={tab} onChange={setTab} testId="entry-tabs"
        options={[{ value: "manual", label: t("manual") }, { value: "sensors", label: t("sensors") }, { value: "visual", label: t("visual") }]} />

      {tab === "manual" && (
        <Glass>
          <form onSubmit={save} noValidate className="flex flex-col gap-3" data-testid="manual-form">
            <div className="grid gap-3 sm:grid-cols-2">
              {MANUAL.map((key) => {
                const p = PARAM_BY_KEY[key];
                const err = errors[key];
                return (
                  <label key={key} className="flex flex-col gap-1 text-[13px] font-medium text-soft">
                    <span>{tr(p.name)} <span className="font-normal text-muted">({p.unit}{p.limits ? `, ${p.limits.min}–${p.limits.max}` : ""})</span></span>
                    <input
                      inputMode="decimal" name={key} data-testid={`input-${key}`} value={values[key] ?? ""} autoComplete="off"
                      aria-invalid={!!err} aria-describedby={err ? `err-${key}` : undefined}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value.slice(0, 12) }))}
                      className={err ? "!border-crit" : ""}
                    />
                    {err && <span id={`err-${key}`} role="alert" className="text-[12.5px] font-normal leading-snug text-crit" data-testid={`error-${key}`}>{tr(err)}</span>}
                    {p.psych && <span className="text-[11.5px] font-normal text-muted">{t("privatePsych")}</span>}
                  </label>
                );
              })}
            </div>
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-soft">
              <input type="checkbox" checked={oneOff} onChange={(e) => setOneOff(e.target.checked)} className="!min-h-0 size-5" /> {t("oneOff")}
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" data-testid="save" className="min-h-[46px] cursor-pointer rounded-[14px] bg-fg px-6 text-[14px] font-semibold text-bg">{t("save")}</button>
              <p role="status" className="text-[13px] text-ok" data-testid="saved">{saved.length > 0 ? `${t("saved")}: ${saved.map((k) => tr(PARAM_BY_KEY[k].name)).join(", ")}` : ""}</p>
            </div>
          </form>
        </Glass>
      )}

      {tab === "sensors" && (
        <Glass>
          <p className="text-[13.5px] leading-relaxed text-soft">{t("syncHint")}</p>
          <button type="button" onClick={() => store.syncSensors()} data-testid="sync-sensors" className="mt-3 min-h-[46px] cursor-pointer rounded-[14px] bg-fg px-6 text-[14px] font-semibold text-bg">{t("syncSensors")}</button>
          {app.events[0]?.kind === "sync" && <p role="status" className="mt-2 text-[13px] text-ok">{tr(app.events[0].label)}</p>}
        </Glass>
      )}

      {tab === "visual" && (
        <Glass>
          <p className="text-[13.5px] leading-relaxed text-soft">{t("visualHint")}</p>
          <a href="/legacy/index.html" className="mt-3 inline-flex min-h-[46px] items-center rounded-[14px] bg-fg px-6 text-[14px] font-semibold text-bg">{t("openLegacy")}</a>
        </Glass>
      )}
    </div>
  );
}
