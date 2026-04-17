import React, { useMemo, useState } from "react";

type Benchmarks = {
  ski500: string;
  ski2000: string;
  row500: string;
  row2000: string;
  run5k: string;
  ftp: number;
  squat5rm: number;
  bss5rm: number;
  deadlift5rm: number;
  weightedPullup: number;
  lungeLoad: number;
};

type Setup = {
  startDate: string;
  raceDate: string;
  saturdayClass: boolean;
};

type Session = {
  day: string;
  name: string;
  main: string;
  strength: string;
  accessory: string;
};

function parseTimeToSeconds(value: string): number | null {
  if (!value.trim()) return null;
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => Number.isNaN(n))) return null;

  if (parts.length === 2) {
    const [m, s] = nums;
    return m * 60 + s;
  }

  const [h, m, s] = nums;
  return h * 3600 + m * 60 + s;
}

function formatSecondsToPace(seconds: number, suffix = ""): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  const whole = Math.floor(secs);
  const tenth = Math.round((secs - whole) * 10) % 10;
  return `${mins}:${String(whole).padStart(2, "0")}.${tenth}${suffix}`;
}

function startOfDay(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const strengthPercents = {
  phase1: { squat: 0.72, deadlift: 0.77, bss: 0.72, pull: 0.77 },
  phase2: { squat: 0.8, deadlift: 0.84, bss: 0.78, pull: 0.84 },
  phase3: { squat: 0.85, deadlift: 0.88, bss: 0.74, pull: 0.79 },
  taper: { squat: 0.65, deadlift: 0.65, bss: 0.6, pull: 0.6 },
};

const phaseColors: Record<string, string> = {
  "Phase 1": "#e0f2fe",
  "Phase 2": "#dcfce7",
  "Phase 3": "#fef3c7",
  Taper: "#ffe4e6",
};

function SectionCard(props: { title: string; children: React.ReactNode; subtitle?: string }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="section-title">{props.title}</h2>
        {props.subtitle ? <p className="subtitle mt-6">{props.subtitle}</p> : null}
      </div>
      <div className="card-body">{props.children}</div>
    </section>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <section className="card metric-card">
      <div className="card-body">
        <div className="metric-label">{props.label}</div>
        <div className="metric-value">{props.value}</div>
      </div>
    </section>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"inputs" | "dashboard" | "plan">("inputs");
  const [benchmarks, setBenchmarks] = useState<Benchmarks>({
    ski500: "1:47.0",
    ski2000: "8:33.3",
    row500: "1:31.7",
    row2000: "7:28.1",
    run5k: "23:10.0",
    ftp: 199,
    squat5rm: 130,
    bss5rm: 22.5,
    deadlift5rm: 190,
    weightedPullup: 20,
    lungeLoad: 20,
  });

  const [setup, setSetup] = useState<Setup>({
    startDate: "",
    raceDate: "",
    saturdayClass: false,
  });

  const derived = useMemo(() => {
    const ski500 = parseTimeToSeconds(benchmarks.ski500);
    const ski2000 = parseTimeToSeconds(benchmarks.ski2000);
    const row500 = parseTimeToSeconds(benchmarks.row500);
    const row2000 = parseTimeToSeconds(benchmarks.row2000);
    const run5k = parseTimeToSeconds(benchmarks.run5k);

    const ski2kSplit = ski2000 ? ski2000 / 4 : null;
    const row2kSplit = row2000 ? row2000 / 4 : null;
    const runPerKm = run5k ? run5k / 5 : null;

    const runHyrox = runPerKm ? runPerKm + 25 : null;
    const runIntervals = runPerKm ? runPerKm - 10 : null;
    const runEasy = runPerKm ? runPerKm + 50 : null;

    const rowThreshold = row2kSplit ? row2kSplit + 3 : null;
    const rowVo2 = row2kSplit ? row2kSplit - 5 : null;
    const skiThreshold = ski2kSplit ? ski2kSplit + 3 : null;
    const skiVo2 = ski2kSplit ? ski2kSplit - 5 : null;

    const rowWeakness = row500 && row2kSplit ? row2kSplit - row500 : null;
    const weaknessFlags: string[] = [];
    if (rowWeakness !== null && rowWeakness > 14) weaknessFlags.push("Row endurance looks weaker than row power.");
    if (runPerKm !== null && row2kSplit !== null && runHyrox !== null && runHyrox > row2kSplit * 2.8) weaknessFlags.push("Running is likely a bigger limiter than the ergs.");
    if (benchmarks.squat5rm >= 125 && runHyrox !== null && runHyrox > 300) weaknessFlags.push("You appear strength-dominant relative to HYROX run pace.");
    if (weaknessFlags.length === 0) weaknessFlags.push("No obvious red flag from the benchmark profile.");

    const z2 = benchmarks.ftp * 0.7;
    const tempo = benchmarks.ftp * 0.8;
    const threshold = benchmarks.ftp * 0.9;
    const vo2 = benchmarks.ftp * 1.05;

    return {
      ski500,
      ski2000,
      row500,
      row2000,
      run5k,
      ski2kSplit,
      row2kSplit,
      runPerKm,
      runHyrox,
      runIntervals,
      runEasy,
      rowThreshold,
      rowVo2,
      skiThreshold,
      skiVo2,
      weaknessFlags,
      bikeZones: { z2, tempo, threshold, vo2 },
    };
  }, [benchmarks]);

  const program = useMemo(() => {
    const start = startOfDay(setup.startDate);
    const race = startOfDay(setup.raceDate);
    const totalDays = daysBetween(start, race);
    const totalWeeks = totalDays !== null ? Math.max(1, Math.ceil(totalDays / 7)) : 9;

    const taperWeeks = totalWeeks >= 8 ? 2 : 1;
    const phase3Weeks = Math.max(1, Math.ceil(totalWeeks * 0.2));
    const phase1Weeks = Math.max(1, Math.floor(totalWeeks * 0.45));
    const phase2Weeks = Math.max(1, totalWeeks - phase1Weeks - phase3Weeks - taperWeeks);

    const weekPhase = (week: number) => {
      if (week <= phase1Weeks) return "Phase 1";
      if (week <= phase1Weeks + phase2Weeks) return "Phase 2";
      if (week <= totalWeeks - taperWeeks) return "Phase 3";
      return "Taper";
    };

    const phaseStrength = (phase: string) => {
      if (phase === "Phase 1") return strengthPercents.phase1;
      if (phase === "Phase 2") return strengthPercents.phase2;
      if (phase === "Phase 3") return strengthPercents.phase3;
      return strengthPercents.taper;
    };

    const rows = Array.from({ length: totalWeeks }, (_, i) => {
      const week = i + 1;
      const phase = weekPhase(week);
      const p = phaseStrength(phase);
      const squatLoad = benchmarks.squat5rm * p.squat;
      const bssLoad = benchmarks.bss5rm * p.bss;
      const deadliftLoad = benchmarks.deadlift5rm * p.deadlift;
      const pullLoad = benchmarks.weightedPullup * p.pull;

      const sessions: Session[] = [
        {
          day: "Day 1",
          name: "Row Threshold",
          main: `RowErg 5x5min @ ${formatSecondsToPace(derived.rowThreshold ?? 0, "/500m")}, 2:00 rest`,
          strength: `Back Squat ${phase === "Phase 1" ? "5x5" : phase === "Phase 2" ? "5x4" : phase === "Phase 3" ? "4x3" : "3x3"} @ ${squatLoad.toFixed(1)} kg`,
          accessory: `Weighted Pull-up ${phase === "Phase 1" ? "4x5" : phase === "Phase 2" ? "4x4" : phase === "Phase 3" ? "3x4" : "2x5"} @ ${pullLoad.toFixed(1)} kg | Hollow hold 3x30s`,
        },
        {
          day: "Day 2",
          name: setup.saturdayClass ? "HYROX Mixed / Saturday Class Replacement Logic" : "HYROX Mixed",
          main:
            phase === "Phase 1"
              ? `3 rounds: Row 1000m @ ${formatSecondsToPace(derived.rowThreshold ?? 0, "/500m")} + Run 800m @ ${formatSecondsToPace(derived.runHyrox ?? 0, "/km")}, rest 2:00`
              : phase === "Phase 2"
                ? `4 rounds: Ski 1000m @ ${formatSecondsToPace(derived.skiThreshold ?? 0, "/500m")} + Run 1km @ ${formatSecondsToPace(derived.runHyrox ?? 0, "/km")} + 20 lunges, rest 2:00`
                : phase === "Phase 3"
                  ? `6 rounds: Run 1km @ ${formatSecondsToPace(derived.runHyrox ?? 0, "/km")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")} + 20 lunges, rest 90s`
                  : `2 rounds: Run 800m @ ${formatSecondsToPace(derived.runHyrox ?? 0, "/km")} + Ski 500m @ ${formatSecondsToPace(derived.skiVo2 ?? 0, "/500m")}, full recovery`,
          strength: `Bulgarian Split Squat ${phase === "Phase 3" ? "3x6/leg" : phase === "Taper" ? "2x6/leg" : "3x8/leg"} @ ${bssLoad.toFixed(1)} kg`,
          accessory: `Walking lunges 4x20 steps @ ${benchmarks.lungeLoad.toFixed(1)} kg | Hip mobility 2x60s/side`,
        },
        {
          day: "Day 3",
          name: "Aerobic Base",
          main:
            phase === "Phase 1"
              ? `BikeErg 60min @ ${Math.round(derived.bikeZones.z2)} W`
              : phase === "Taper"
                ? `BikeErg 30min @ ${Math.round(derived.bikeZones.z2)} W`
                : `BikeErg 40min @ ${Math.round(derived.bikeZones.z2)} W${phase === "Phase 2" ? ` + easy run @ ${formatSecondsToPace(derived.runEasy ?? 0, "/km")}` : ""}`,
          strength: phase === "Taper" ? "-" : `Deadlift ${phase === "Phase 1" ? "5x3" : phase === "Phase 2" ? "4x4" : "4x3"} @ ${deadliftLoad.toFixed(1)} kg`,
          accessory: `Tibialis raises 3x20 | Eccentric calf raises 3x15 | Plank 3x45s`,
        },
        {
          day: "Day 4",
          name: "Ski / Run Threshold",
          main:
            phase === "Phase 1" || phase === "Phase 2"
              ? `SkiErg 4x5min @ ${formatSecondsToPace(derived.skiThreshold ?? 0, "/500m")}, 2:00 rest`
              : phase === "Phase 3"
                ? `Ski 500m @ ${formatSecondsToPace(derived.skiVo2 ?? 0, "/500m")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")}`
                : `Run @ ${formatSecondsToPace(derived.runHyrox ?? 0, "/km")} | Row @ ${formatSecondsToPace(derived.rowThreshold ?? 0, "/500m")}`,
          strength:
            phase === "Phase 1"
              ? `Back Squat 5x5 @ ${squatLoad.toFixed(1)} kg`
              : phase === "Phase 2"
                ? `Bulgarian Split Squat 3x8/leg @ ${bssLoad.toFixed(1)} kg`
                : phase === "Phase 3"
                  ? `Bulgarian Split Squat 3x6/leg @ ${bssLoad.toFixed(1)} kg`
                  : "-",
          accessory: phase === "Taper" ? "Easy activation: band work 2x12 | Breathing 5min" : "Farmer carry 4x20m | Side plank 3x30s/side",
        },
        {
          day: "Day 5",
          name: "Compromised Intervals",
          main:
            phase === "Phase 1"
              ? `6 rounds: Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")} + Ski 500m @ ${formatSecondsToPace(derived.skiVo2 ?? 0, "/500m")}, rest 90s`
              : phase === "Phase 2"
                ? `5 rounds: 20 lunges + Run 1km @ ${formatSecondsToPace(derived.runIntervals ?? 0, "/km")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")}, rest 90s`
                : phase === "Phase 3"
                  ? `5 rounds: Run 1km @ ${formatSecondsToPace(derived.runHyrox ?? 0, "/km")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")}, rest 90s`
                  : `Off feet or very easy spin`,
          strength:
            phase === "Phase 1"
              ? `Bulgarian Split Squat 3x8/leg @ ${bssLoad.toFixed(1)} kg`
              : phase === "Phase 2"
                ? `Back Squat 5x4 @ ${squatLoad.toFixed(1)} kg`
                : phase === "Phase 3"
                  ? `Back Squat 4x3 @ ${squatLoad.toFixed(1)} kg`
                  : "-",
          accessory: `Dead bug 3x10/side | Tibialis raises 3x20 | Couch stretch 2x45s/side`,
        },
        {
          day: "Day 6",
          name: "Optional Recovery",
          main: `BikeErg 30min @ ${Math.round(derived.bikeZones.z2)} W`,
          strength: "-",
          accessory: `Mobility flow 15min | Easy walk 20-30min`,
        },
        {
          day: "Day 7",
          name: "Rest",
          main: `Rest day — no training prescribed`,
          strength: "-",
          accessory: "-",
        },
      ];

      if (setup.saturdayClass) {
        sessions[5] = {
          day: "Day 6",
          name: "Group HYROX Class",
          main: phase === "Taper" ? "Attend lightly only: technique and rhythm, no redlining" : "Treat as the week’s second compromised session. Control intensity and do not race the room.",
          strength: "-",
          accessory: "Replace added volume, do not stack another hard hybrid session on top.",
        };
      }

      return { week, phase, sessions };
    });

    return {
      totalDays,
      totalWeeks,
      phase1Weeks,
      phase2Weeks,
      phase3Weeks,
      taperWeeks,
      rows,
    };
  }, [setup, benchmarks, derived]);

  const benchmarkCards = [
    { label: "HYROX Run Pace", value: derived.runHyrox ? formatSecondsToPace(derived.runHyrox, "/km") : "-" },
    { label: "Row VO2 Split", value: derived.rowVo2 ? formatSecondsToPace(derived.rowVo2, "/500m") : "-" },
    { label: "Ski VO2 Split", value: derived.skiVo2 ? formatSecondsToPace(derived.skiVo2, "/500m") : "-" },
    { label: "Bike Z2", value: `${Math.round(derived.bikeZones.z2)} W` },
  ];

  const inputTimeFields: Array<[string, keyof Benchmarks]> = [
    ["Ski 500", "ski500"],
    ["Ski 2000", "ski2000"],
    ["Row 500", "row500"],
    ["Row 2000", "row2000"],
    ["5km run", "run5k"],
  ];

  const inputNumberFields: Array<[string, keyof Benchmarks]> = [
    ["FTP", "ftp"],
    ["Back Squat 5RM", "squat5rm"],
    ["BSS 5RM", "bss5rm"],
    ["Deadlift 5RM", "deadlift5rm"],
    ["Weighted Pull-up", "weightedPullup"],
    ["Lunge Load", "lungeLoad"],
  ];

  return (
    <div className="page-shell">
      <div className="app-container">
        <div className="grid-2">
          <SectionCard
            title="HYROX Planner App"
            subtitle="Vite-ready React version based on your spreadsheet logic. This is structured to be moved into a standard project and deployed later on Netlify."
          >
            <div className="stack-12">
              <div className="subtitle">Built from your spreadsheet logic: benchmarks, date-driven phase allocation, pacing, strength progression, and a full weekly plan.</div>
            </div>
          </SectionCard>

          <SectionCard title="Programme Window">
            <div className="metric-stack">
              <div className="metric-row"><span>Total days</span><strong>{program.totalDays ?? "-"}</strong></div>
              <div className="metric-row"><span>Total weeks</span><strong>{program.totalDays !== null ? program.totalWeeks : "-"}</strong></div>
              <div className="metric-row"><span>Phase 1</span><strong>{program.totalDays !== null ? program.phase1Weeks : "-"}</strong></div>
              <div className="metric-row"><span>Phase 2</span><strong>{program.totalDays !== null ? program.phase2Weeks : "-"}</strong></div>
              <div className="metric-row"><span>Phase 3</span><strong>{program.totalDays !== null ? program.phase3Weeks : "-"}</strong></div>
              <div className="metric-row"><span>Taper</span><strong>{program.totalDays !== null ? program.taperWeeks : "-"}</strong></div>
            </div>
          </SectionCard>
        </div>

        <div className="tab-bar">
          <button className={activeTab === "inputs" ? "tab-button active" : "tab-button"} onClick={() => setActiveTab("inputs")}>Inputs</button>
          <button className={activeTab === "dashboard" ? "tab-button active" : "tab-button"} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
          <button className={activeTab === "plan" ? "tab-button active" : "tab-button"} onClick={() => setActiveTab("plan")}>Plan</button>
        </div>

        {activeTab === "inputs" ? (
          <div className="grid-2">
            <SectionCard title="Programme Setup">
              <div className="stack-16">
                <div className="field-group">
                  <label className="label">Start date</label>
                  <input className="input" type="date" value={setup.startDate} onChange={(e) => setSetup((s) => ({ ...s, startDate: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label className="label">Race date</label>
                  <input className="input" type="date" value={setup.raceDate} onChange={(e) => setSetup((s) => ({ ...s, raceDate: e.target.value }))} />
                </div>
                {setup.startDate && setup.raceDate && program.totalDays === null ? (
                  <div className="warning-box">Race date must be after the start date.</div>
                ) : null}
                <div className="switch-row">
                  <div>
                    <div className="switch-title">Include Saturday HYROX class</div>
                    <div className="switch-subtitle">Replaces an existing hard hybrid session rather than adding extra load.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={setup.saturdayClass}
                    onChange={(e) => setSetup((s) => ({ ...s, saturdayClass: e.target.checked }))}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Benchmarks">
              <div className="grid-3">
                {inputTimeFields.map(([label, key]) => (
                  <div key={key} className="field-group">
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      value={String(benchmarks[key])}
                      onChange={(e) => setBenchmarks((b) => ({ ...b, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                {inputNumberFields.map(([label, key]) => (
                  <div key={key} className="field-group">
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      value={Number(benchmarks[key])}
                      onChange={(e) => setBenchmarks((b) => ({ ...b, [key]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "dashboard" ? (
          <div className="stack-16">
            <div className="grid-3">
              {benchmarkCards.map((item) => (
                <MetricCard key={item.label} label={item.label} value={item.value} />
              ))}
            </div>

            <div className="grid-2">
              <SectionCard title="Weakness Analysis">
                <div className="stack-10">
                  {derived.weaknessFlags.map((flag, idx) => (
                    <div key={idx} className="soft-block bordered">{flag}</div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Reference Zones">
                <div className="stack-10">
                  <div className="soft-block bordered">
                    <div className="zone-title">Row VO2</div>
                    <div>{derived.row2kSplit ? `${formatSecondsToPace(derived.row2kSplit - 6, "/500m")} to ${formatSecondsToPace(derived.row2kSplit - 4, "/500m")}` : "-"}</div>
                  </div>
                  <div className="soft-block bordered">
                    <div className="zone-title">Row Threshold</div>
                    <div>{derived.row2kSplit ? `${formatSecondsToPace(derived.row2kSplit + 2, "/500m")} to ${formatSecondsToPace(derived.row2kSplit + 4, "/500m")}` : "-"}</div>
                  </div>
                  <div className="soft-block bordered">
                    <div className="zone-title">Ski VO2</div>
                    <div>{derived.ski2kSplit ? `${formatSecondsToPace(derived.ski2kSplit - 6, "/500m")} to ${formatSecondsToPace(derived.ski2kSplit - 4, "/500m")}` : "-"}</div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}

        {activeTab === "plan" ? (
          <div className="stack-16">
            {program.rows.map((week) => (
              <div key={week.week} className="card">
                <div className="card-header">
                  <div className="week-header">
                    <h2 className="section-title">Week {week.week}</h2>
                    <span className="phase-pill" style={{ background: phaseColors[week.phase] }}>{week.phase}</span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="stack-12">
                    {week.sessions.map((session) => (
                      <div key={`${week.week}-${session.day}`} className="session-card">
                        <div className="session-heading">
                          <div className="session-day">{session.day}</div>
                          <div className="session-name">{session.name}</div>
                        </div>
                        <div className="grid-3">
                          <div className="soft-block">
                            <div className="small-caps">Main Set</div>
                            <div className="session-copy">{session.main || "-"}</div>
                          </div>
                          <div className="soft-block">
                            <div className="small-caps">Strength</div>
                            <div className="session-copy">{session.strength || "-"}</div>
                          </div>
                          <div className="soft-block">
                            <div className="small-caps">Accessory</div>
                            <div className="session-copy">{session.accessory || "-"}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="card">
          <div className="card-body footer-row">
            <div className="subtitle">
              This project is ready to be wrapped in a normal Vite file structure and pushed to a Git repo for Netlify deployment.
            </div>
            <button className="footer-button" type="button">Deployable next step</button>
          </div>
        </div>
      </div>
    </div>
  );
}
