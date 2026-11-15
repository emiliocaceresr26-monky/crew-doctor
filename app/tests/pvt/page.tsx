"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Glass, LevelBadge, useApp, useT } from "@/components/ui";
import { evaluate } from "@/lib/engine";
import { PARAM_BY_KEY } from "@/lib/parameters";
import { nextIsi, PVT_DEMO_SEC, PVT_FULL_SEC, summarizePvt, type PvtSummary } from "@/lib/pvt";
import { store } from "@/lib/store";

type Stage = "intro" | "waiting" | "stimulus" | "done";

/** PVT-B vigilance test (RF-13). The result is stored as a reading with source = "test". */
export default function PvtPage() {
  const app = useApp();
  const router = useRouter();
  const { lang, n } = useT();
  const L = (en: string, es: string) => (lang === "es" ? es : en);
  const [stage, setStage] = useState<Stage>("intro");
  const [elapsed, setElapsed] = useState(0);
  const [lastRt, setLastRt] = useState<number | null>(null);
  const [early, setEarly] = useState(false);
  const [summary, setSummary] = useState<PvtSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  const stageRef = useRef<Stage>("intro");
  const rts = useRef<number[]>([]);
  const falseStarts = useRef(0);
  const shownAt = useRef(0);
  const endAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0);
  const go = (s: Stage) => { stageRef.current = s; setStage(s); };

  const finish = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    const s = summarizePvt(rts.current, falseStarts.current);
    setSummary(s);
    go("done");
    if (!s.valid) { setError(L("Too few valid responses: nothing was saved. Try again.", "Muy pocas respuestas válidas: no se guardó nada. Inténtalo de nuevo.")); return; }
    const err = store.submit({ parameter: "pvt_rt", value: s.meanRt, source: "test" });
    if (err) { setError(err[lang]); return; }
    const st = store.getState();
    fetch("/api/readings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ astronautId: st.astronautId, phase: st.phase, source: "test", items: [{ parameter_key: "pvt_rt", value: s.meanRt }] }) }).catch(() => { /* offline: stays local */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const schedule = useCallback(() => {
    go("waiting");
    timer.current = setTimeout(() => {
      if (performance.now() >= endAt.current) return finish();
      shownAt.current = performance.now();
      go("stimulus");
      const loop = () => { if (stageRef.current !== "stimulus") return; setElapsed(Math.round(performance.now() - shownAt.current)); raf.current = requestAnimationFrame(loop); };
      raf.current = requestAnimationFrame(loop);
    }, nextIsi());
  }, [finish]);

  const start = (seconds: number) => {
    rts.current = []; falseStarts.current = 0;
    setSummary(null); setError(null); setLastRt(null); setEarly(false);
    endAt.current = performance.now() + seconds * 1000;
    schedule();
  };

  const respond = useCallback(() => {
    if (stageRef.current === "stimulus") {
      const rt = Math.round(performance.now() - shownAt.current);
      cancelAnimationFrame(raf.current);
      rts.current.push(rt);
      setLastRt(rt); setEarly(false);
      if (performance.now() >= endAt.current) finish(); else schedule();
    } else if (stageRef.current === "waiting") {
      falseStarts.current += 1;
      setEarly(true);
    }
  }, [finish, schedule]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space" && (stageRef.current === "waiting" || stageRef.current === "stimulus")) { e.preventDefault(); respond(); } };
    window.addEventListener("keydown", onKey);
    const id = setInterval(() => { if (stageRef.current === "waiting" || stageRef.current === "stimulus") { setLeft(Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000))); if (performance.now() >= endAt.current && stageRef.current === "waiting") finish(); } }, 250);
    return () => { window.removeEventListener("keydown", onKey); clearInterval(id); if (timer.current) clearTimeout(timer.current); cancelAnimationFrame(raf.current); };
  }, [finish, respond]);

  const param = PARAM_BY_KEY.pvt_rt;
  const base = store.baseline(app.astronautId, "pvt_rt");
  const quick = process.env.NEXT_PUBLIC_E2E === "1" ? 6 : null;
  const running = stage === "waiting" || stage === "stimulus";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3" data-testid="pvt">
      <Glass>
        <p className="eyebrow">{L("On-screen test · Cognition", "Prueba en pantalla · Cognición")}</p>
        <h1 className="display mt-1 text-2xl font-semibold">{L("Vigilance test (PVT-B)", "Prueba de vigilancia (PVT-B)")}</h1>
        {stage === "intro" && (
          <>
            <p className="mt-2 text-[14px] leading-relaxed text-soft">
              {L("A counter will appear at random moments. Tap the big area or press the space bar as fast as you can. Do not tap before it appears.",
                "Aparecerá un contador en momentos al azar. Toca el área grande o pulsa la barra espaciadora lo más rápido que puedas. No toques antes de que aparezca.")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => start(PVT_FULL_SEC)} data-testid="pvt-start-full" className="min-h-[46px] cursor-pointer rounded-[14px] bg-fg px-5 text-[14px] font-semibold text-bg">{L("Start · 3 min", "Iniciar · 3 min")}</button>
              <button type="button" onClick={() => start(PVT_DEMO_SEC)} data-testid="pvt-start-demo" className="min-h-[46px] cursor-pointer rounded-[14px] border border-line px-5 text-[14px] font-medium">{L("Demo · 30 s", "Demo · 30 s")}</button>
              {quick && <button type="button" onClick={() => start(quick)} data-testid="pvt-start-quick" className="min-h-[46px] cursor-pointer rounded-[14px] border border-dashed border-line px-5 text-[14px]">E2E · {quick} s</button>}
              <button type="button" onClick={() => router.back()} className="flex min-h-[46px] items-center gap-2 rounded-[14px] border border-accent/40 bg-accent/10 px-5 text-[14px] font-medium text-accent" data-testid="pvt-back">
                <ArrowLeft size={16} aria-hidden="true" /> {L("Go back", "Volver atrás")}
              </button>
            </div>
          </>
        )}
      </Glass>

      {running && (
        <button type="button" onPointerDown={(e) => { e.preventDefault(); respond(); }} data-testid="pvt-target" data-stage={stage}
          aria-label={L("Reaction area: tap when the counter appears", "Área de reacción: toca cuando aparezca el contador")}
          className={`glass flex h-72 cursor-pointer select-none flex-col items-center justify-center gap-2 ${stage === "stimulus" ? "!border-warn bg-warn/10" : ""}`}>
          <span className="display text-6xl font-bold tabular-nums" aria-live="off">{stage === "stimulus" ? elapsed : "·"}</span>
          <span className="text-[13px] text-muted">{early ? L("Too early — wait for the counter", "Muy pronto: espera el contador") : lastRt !== null ? `${lastRt} ms` : L("Wait…", "Espera…")}</span>
          <span className="text-[12px] text-muted">{left} s</span>
        </button>
      )}

      {stage === "done" && summary && (
        <Glass data-testid="pvt-result" aria-live="polite">
          <p className="eyebrow">{L("Result", "Resultado")}</p>
          <p className="display mt-1 text-5xl font-bold" data-testid="pvt-mean">{n(summary.meanRt, 0)} <span className="text-lg font-medium text-muted">ms</span></p>
          {summary.valid && <p className="mt-2"><LevelBadge level={evaluate(param, summary.meanRt, base).level} /></p>}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[13.5px] sm:grid-cols-4">
            <div><dt className="text-muted">{L("Responses", "Respuestas")}</dt><dd className="font-semibold">{summary.trials}</dd></div>
            <div><dt className="text-muted">{L("Median", "Mediana")}</dt><dd className="font-semibold">{summary.medianRt} ms</dd></div>
            <div><dt className="text-muted">{L("Lapses (≥ 355 ms)", "Lapsos (≥ 355 ms)")}</dt><dd className="font-semibold">{summary.lapses}</dd></div>
            <div><dt className="text-muted">{L("False starts", "Salidas en falso")}</dt><dd className="font-semibold">{summary.falseStarts}</dd></div>
          </dl>
          <p className="mt-3 text-[13px] text-soft">
            {base ? L(`Your baseline: ${n(base.mean, 0)} ms. `, `Tu línea base: ${n(base.mean, 0)} ms. `) : ""}
            {error ?? L("Saved as an on-screen test reading (source: test, not simulated).", "Guardado como lectura de prueba en pantalla (origen: test, no simulado).")}
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard" className="flex min-h-[46px] items-center rounded-[14px] bg-fg px-5 text-[14px] font-semibold text-bg" data-testid="pvt-to-dashboard">{L("See it on the dashboard", "Verlo en el panel")}</Link>
            <button type="button" onClick={() => go("intro")} className="min-h-[46px] cursor-pointer rounded-[14px] border border-line px-5 text-[14px] font-medium">{L("Repeat", "Repetir")}</button>
            <button type="button" onClick={() => router.back()} className="flex min-h-[46px] items-center gap-2 rounded-[14px] border border-accent/40 bg-accent/10 px-5 text-[14px] font-medium text-accent" data-testid="pvt-back-result">
              <ArrowLeft size={16} aria-hidden="true" /> {L("Go back", "Volver atrás")}
            </button>
          </div>
        </Glass>
      )}
    </div>
  );
}
