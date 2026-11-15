"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, ChartLine, Gauge, Home, PersonStanding, PlusCircle, Radio, Settings } from "lucide-react";
import { CREW, formatDelay, SCENARIO_BY_ID, SCENARIOS } from "@/lib/crew";
import type { DictKey } from "@/lib/i18n";
import { ALERT_PROFILE_ID, TICK_MS } from "@/lib/simulator";
import { store, viewOf, type View } from "@/lib/store";
import type { Phase, Role, ScenarioId } from "@/lib/types";
import { Ora } from "./Ora";
import { Backdrop, Segmented, useApp, useT } from "./ui";

type NavItem = { href: string; key: DictKey; icon: typeof Home };
/** Astronaut view: own health only. Ground view: complete monitoring of the crew. */
const NAV: Record<View, NavItem[]> = {
  crew: [
    { href: "/", key: "navMyHealth", icon: Home },
    { href: "/body", key: "navBody", icon: PersonStanding },
    { href: "/entry", key: "navEntry", icon: PlusCircle },
  ],
  ground: [
    { href: "/dashboard", key: "navOverview", icon: Gauge },
    { href: "/timeline", key: "navTimeline", icon: ChartLine },
    { href: "/control", key: "navControl", icon: Radio },
  ],
};
const HOME: Record<View, string> = { crew: "/", ground: "/dashboard" };
const GROUND_ONLY = ["/dashboard", "/timeline", "/control"];
const CREW_ONLY = ["/", "/body"];

/** True when the keyboard event comes from a place where the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable || !!target.closest("[contenteditable='true'],[role='textbox']");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { t, tr, lang } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scenario = SCENARIO_BY_ID[app.scenarioId];
  const view = viewOf(app.role);

  // Keep each view on its own pages: the crew never lands on the ground dashboards and vice versa.
  useEffect(() => {
    if (!app.ready) return;
    if (view === "crew" && GROUND_ONLY.includes(pathname)) router.replace(HOME.crew);
    if (view === "ground" && CREW_ONLY.includes(pathname)) router.replace(HOME.ground);
  }, [app.ready, view, pathname, router]);

  const switchView = (v: View) => {
    if (v === view) return;
    store.setRole(v === "crew" ? "astronaut" : "flight_surgeon");
    router.push(HOME[v]);
  };

  useEffect(() => {
    store.init();
    const id = setInterval(() => { if (!document.hidden) store.tick(); }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Demo mode shortcut. Only genuine key presses (isTrusted) outside editable fields count,
  // so injected content or dictated text can never toggle it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "d" && e.key !== "D") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      store.toggleDemo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-3 pb-28 pt-3 sm:px-5 lg:pb-8">
      <Backdrop />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-fg focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>

      <header className="no-print flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={HOME[view]} className="flex items-center gap-2.5 rounded-full" aria-label="Doctor's Crew">
              <Image src="/logo.png" alt="" width={40} height={40} priority className="size-10 rounded-full shadow-[0_0_18px_rgba(96,165,250,0.35)]" />
              <span className="display text-xl font-bold tracking-tight">Doctor&apos;s <span className="text-accent">Crew</span></span>
            </Link>
            <span className="hidden text-[13px] text-muted sm:inline">{t("appTagline")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {app.demoMode && (
              <span data-testid="demo-indicator" className="rounded-full border border-warn/60 bg-warn/15 px-3 py-1 text-[12px] font-bold tracking-widest text-warn">
                {t("demoOn")}
              </span>
            )}
            <span className="rounded-full border border-line px-3 py-1 text-[12px] text-soft" data-testid="link-delay">
              {t("earthLink")} · {formatDelay(scenario.delaySec, lang)}
            </span>
            <button type="button" onClick={() => store.setLang(lang === "en" ? "es" : "en")} aria-label={t("language")} data-testid="lang-toggle"
              className="min-h-10 cursor-pointer rounded-full border border-line px-3 text-[12.5px] font-semibold text-soft hover:text-fg">
              {lang === "en" ? "ES" : "EN"}
            </button>
            <button type="button" onClick={() => setSettingsOpen((v) => !v)} aria-expanded={settingsOpen} aria-controls="advanced-settings" data-testid="settings-toggle"
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] font-semibold text-soft hover:text-fg">
              <Settings size={15} aria-hidden="true" /> <span className="hidden sm:inline">{t("advanced")}</span>
            </button>
          </div>
        </div>

        {/* Live region: announces demo mode changes to assistive tech */}
        <p aria-live="polite" className="sr-only" data-testid="demo-live">{app.ready ? (app.demoMode ? t("demoOnLong") : t("demoOffLong")) : ""}</p>

        {settingsOpen && (
          <div id="advanced-settings" className="glass flex flex-wrap items-end gap-4 p-4">
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              {t("role")}
              <select value={app.role} onChange={(e) => store.setRole(e.target.value as Role)} data-testid="role-select">
                {(["astronaut", "flight_surgeon", "flight_psychologist", "commander"] as Role[]).map((r) => <option key={r} value={r}>{t(`role_${r}` as DictKey)}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-[12px] text-muted">
              {t("viewMode")}
              <Segmented label={t("viewMode")} value={app.mode} onChange={(m) => store.setMode(m)} testId="mode-select"
                options={[{ value: "simple", label: t("simple") }, { value: "expert", label: t("expert") }]} />
            </div>
            <button type="button" onClick={() => store.toggleDemo()} aria-pressed={app.demoMode} data-testid="demo-button"
              className={`min-h-11 cursor-pointer rounded-[14px] border px-4 text-[13.5px] font-semibold ${app.demoMode ? "border-warn/60 bg-warn/15 text-warn" : "border-line text-fg"}`}>
              {t("demoToggle")}: {app.demoMode ? "ON" : "OFF"}
            </button>
            <p className="basis-full text-[12.5px] text-soft">{app.demoMode ? t("demoOnLong") : t("demoOffLong")}</p>
          </div>
        )}

        <Segmented label={t("viewSwitch")} testId="view-select" value={view} onChange={switchView}
          options={[{ value: "crew", label: t("viewCrew") }, { value: "ground", label: t("viewGround") }]} />

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
          <Segmented label={t("scenario")} testId="scenario-select" value={app.scenarioId} onChange={(v: ScenarioId) => store.setScenario(v)}
            options={SCENARIOS.map((s) => ({ value: s.id, label: tr(s.short) }))} />
          <Segmented label={t("phase")} testId="phase-select" value={app.phase} onChange={(v: Phase) => store.setPhase(v)}
            options={(["pre", "mission", "post"] as Phase[]).map((p) => ({ value: p, label: t(`phase_${p}` as DictKey) }))} />
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <span className="sr-only">{t("crewMember")}</span>
            <select value={app.astronautId} onChange={(e) => store.setAstronaut(e.target.value)} data-testid="crew-select" aria-label={t("crewMember")} className="w-full">
              {CREW.map((a) => <option key={a.id} value={a.id}>{a.name} · {tr(a.role)}{a.id === ALERT_PROFILE_ID ? ` · ${t("alertShowcase")}` : ""}</option>)}
            </select>
          </label>
        </div>

        <nav aria-label={t("mainNav")} className="glass fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-[28px] bg-[rgba(14,21,40,0.9)] lg:static lg:h-auto lg:justify-start lg:gap-1 lg:rounded-[16px] lg:p-1">
          {NAV[view].map(({ href, key, icon: Icon }) => {
            const on = pathname === href;
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[12px] px-1 text-center text-[10.5px] leading-tight lg:flex-none lg:flex-row lg:text-left lg:gap-2 lg:px-4 lg:text-[13.5px] ${on ? "font-semibold text-accent lg:bg-accent/15" : "font-medium text-muted hover:text-fg"}`}>
                <Icon size={20} aria-hidden="true" /> {t(key)}
              </Link>
            );
          })}
          {view === "crew" && <a href="/legacy/index.html" className="hidden min-h-12 items-center gap-2 rounded-[12px] px-4 text-[13.5px] font-medium text-muted hover:text-fg lg:flex">
            <Activity size={20} aria-hidden="true" /> {t("navLegacy")}
          </a>}
        </nav>
      </header>

      <main id="main" className="mt-4 flex-1">{app.ready ? children : <p className="p-8 text-center text-muted">…</p>}</main>

      {app.ready && <Ora />}
      <footer className="mt-6 text-center text-[12px] leading-relaxed text-muted" data-testid="disclaimer">{t("disclaimer")}</footer>
    </div>
  );
}
