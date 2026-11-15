"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { guideFor } from "@/content/guide";
import { CREW_BY_ID } from "@/lib/crew";
import { PARAM_BY_KEY } from "@/lib/parameters";
import { HABITAT, seriesKey } from "@/lib/simulator";
import { dailySeries, statusOf, store } from "@/lib/store";
import { LEVEL_COLOR, LevelBadge, SimBadge, useApp, useT } from "./ui";

/** Detail view: 14-day series with safe band and baseline (RF-05) + "What does it mean?" (RF-06). */
export function ParamDetail({ paramKey, onClose }: { paramKey: string | null; onClose: () => void }) {
  const app = useApp();
  const { t, tr, n, lang } = useT();
  const param = paramKey ? PARAM_BY_KEY[paramKey] : null;
  if (!param) return null;

  const subject = param.scope === "habitat" ? HABITAT : app.astronautId;
  const status = statusOf(app, app.astronautId, param);
  const base = store.baseline(subject, param.key);
  const data = dailySeries(app, app.astronautId, param, app.phase).map((d) => ({
    label: new Date(d.day).toLocaleDateString(lang === "es" ? "es-CL" : "en-US", { day: "numeric", month: "short" }),
    value: Number(d.value.toFixed(param.sim?.decimals ?? 1)),
  }));
  const guide = guideFor(param.key);
  const rg = param.range;
  const values = data.map((d) => d.value);
  const marks = [...values, rg?.warnLow, rg?.warnHigh, base?.mean].filter((v): v is number => typeof v === "number");
  const lo = Math.min(...marks);
  const hi = Math.max(...marks);
  const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.15;
  const domain: [number, number] = [Number((lo - pad).toFixed(2)), Number((hi + pad).toFixed(2))];
  const who = param.scope === "habitat" ? t("habitat") : CREW_BY_ID[app.astronautId]?.name;
  const live = (app.readings[seriesKey(subject, param.key)] ?? []).filter((r) => r.phase === app.phase).length;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content data-testid="param-detail" className="glass fixed inset-x-2 bottom-2 top-2 z-50 mx-auto max-w-3xl overflow-y-auto bg-[rgba(10,16,32,0.96)] p-5 sm:inset-y-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{who} · {tr(param.sourceLabel)} · {tr(param.frequency)}</p>
              <Dialog.Title className="display mt-1 text-2xl font-semibold">{tr(param.name)}</Dialog.Title>
            </div>
            <Dialog.Close aria-label={t("close")} className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-line text-soft hover:text-fg"><X size={18} aria-hidden="true" /></Dialog.Close>
          </div>

          {status && (
            <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
              <p className="display text-5xl font-bold" style={{ color: LEVEL_COLOR[status.evaluation.level] }} data-testid="detail-value">
                {n(status.value, param.sim?.decimals)} <span className="text-lg font-medium text-muted">{param.unit}</span>
              </p>
              <div className="flex flex-col gap-1.5 pb-1.5">
                <LevelBadge level={status.evaluation.level} />
                <SimBadge simulated={status.isSimulated} />
              </div>
              <p className="pb-2 text-[13px] text-soft">
                {base ? `${t("yourBaseline")}: ${n(base.mean, 1)} ± ${n(base.sd, 1)} ${param.unit}` : t("noBaseline")}
              </p>
            </div>
          )}
          {status && status.evaluation.reasons.length > 0 && (
            <div className="mt-3 rounded-[14px] border border-line bg-white/5 p-3 text-[13.5px] leading-relaxed text-soft" data-testid="detail-why">
              <p className="eyebrow mb-1">{t("why")}</p>
              {status.evaluation.reasons.map((r, i) => <p key={i}>{tr(r)}</p>)}
            </div>
          )}

          <Dialog.Description className="eyebrow mt-5">{t("trend14")} · {live} {lang === "es" ? "lecturas" : "readings"}</Dialog.Description>
          <div className="mt-2 h-56 w-full" data-testid="detail-chart" role="img" aria-label={`${t("trend14")}: ${tr(param.name)}. ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#AEB9CC", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.2)" }} minTickGap={18} />
                <YAxis domain={domain} tick={{ fill: "#AEB9CC", fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                {rg && (rg.warnLow !== undefined || rg.warnHigh !== undefined) && (
                  <ReferenceArea y1={rg.warnLow ?? domain[0]} y2={rg.warnHigh ?? domain[1]} fill="#4ADE80" fillOpacity={0.09} stroke="#4ADE80" strokeOpacity={0.35} strokeDasharray="4 4" ifOverflow="hidden" />
                )}
                {base && <ReferenceLine y={base.mean} stroke="#7DB4FF" strokeDasharray="6 4" label={{ value: t("baseline"), fill: "#7DB4FF", fontSize: 11, position: "insideTopRight" }} />}
                <Tooltip contentStyle={{ background: "#0E1528", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, color: "#F2F5FA" }} formatter={(v) => [`${v} ${param.unit}`, tr(param.name)]} />
                <Line type="monotone" dataKey="value" stroke="#F2F5FA" strokeWidth={2} dot={{ r: 2.5, fill: "#F2F5FA" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted" data-testid="detail-source">
            {rg ? <><span className="text-ok">■</span> {t("safeBand")} · {t("source")}: {rg.source}. {t("validate")}.</> : t("noRange")}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="guide">
            <div className="rounded-[16px] border border-line p-3.5">
              <p className="eyebrow">{t("meaning")}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-soft">{tr(guide.meaning)}</p>
            </div>
            <div className="rounded-[16px] border border-line p-3.5">
              <p className="eyebrow">{t("whySpace")}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-soft">{tr(guide.whyInSpace)}</p>
            </div>
            <div className="rounded-[16px] border border-line p-3.5 sm:col-span-2">
              <p className="eyebrow">{t("countermeasures")}</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-fg">
                {guide.actions.map((a, i) => <li key={i}>{tr(a)}</li>)}
              </ol>
              <p className="mt-2 text-[12px] text-muted">{tr(guide.hrpRisk)}</p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
