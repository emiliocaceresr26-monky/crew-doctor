"use client";

import Link from "next/link";
import { useState } from "react";
import { AlteredMonitor, EpiPanel, SimpleKeyParams, TriageCard } from "@/components/health";
import { ParamDetail } from "@/components/ParamDetail";
import { useApp, useT } from "@/components/ui";
import { CREW_BY_ID } from "@/lib/crew";
import { FEATURED } from "@/lib/parameters";

/**
 * Astronaut view (crew). Kept deliberately light: the crew member is not a clinician.
 * 1) plain-language status (from the IITT triage), 2) the key parameters as status words,
 * 3) PPE and actions for symptoms that may harm them or the crew, 4) anything else that is
 * out of range, as a short list. Vital signs and full dashboards live in the ground view.
 */
export default function MyHealthPage() {
  const app = useApp();
  const { t, lang } = useT();
  const [detail, setDetail] = useState<string | null>(null);
  const person = CREW_BY_ID[app.astronautId];

  return (
    <div className="flex flex-col gap-3" data-testid="crew-view">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[13px] text-muted">{new Date().toLocaleDateString(lang === "es" ? "es-CL" : "en-US", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="display text-[26px] font-semibold">{t("hello")}, {person?.name.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/entry" className="flex min-h-[44px] items-center rounded-[14px] bg-fg px-4 text-[14px] font-semibold text-bg">{t("navEntry")}</Link>
          <a href="/legacy/index.html" className="flex min-h-[44px] items-center rounded-[14px] border border-white/15 bg-white/10 px-4 text-[14px] font-medium">{t("navLegacy")}</a>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <TriageCard subject={app.astronautId} simple />
        <EpiPanel subject={app.astronautId} simple />
      </div>

      <SimpleKeyParams onOpen={setDetail} />
      <AlteredMonitor subject={app.astronautId} onOpen={setDetail} exclude={FEATURED.map((p) => p.key)} simple />

      <ParamDetail paramKey={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
