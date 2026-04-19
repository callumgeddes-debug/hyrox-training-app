import React, { useEffect, useMemo, useState } from "react";

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

type RunMode = "full" | "reduced" | "none";
type ReplacementTool = "bike" | "row" | "ski" | "mixed";
type RunFocus = "auto" | "low" | "balanced" | "high";

type Setup = {
  startDate: string;
  raceDate: string;
  saturdayClass: boolean;
  runMode: RunMode;
  replacementTool: ReplacementTool;
  runFocus: RunFocus;
};

type Session = {
  day: string;
  name: string;
  main: string;
  strength: string;
  accessory: string;
};

type ActiveTab = "today" | "inputs" | "dashboard" | "plan";

type Profile = {
  id: string;
  name: string;
  benchmarks: Benchmarks;
  setup: Setup;
  updatedAt: string;
};

type BuildState = {
  benchmarks: Benchmarks;
  setup: Setup;
};

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1100;

const STORAGE_KEYS = {
  currentBenchmarks: "hyrox_planner_current_benchmarks",
  currentSetup: "hyrox_planner_current_setup",
  profiles: "hyrox_planner_profiles",
  lastBuiltState: "hyrox_planner_last_built_state",
};

const defaultBenchmarks: Benchmarks = {
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
};

const defaultSetup: Setup = {
  startDate: "",
  raceDate: "",
  saturdayClass: false,
  runMode: "full",
  replacementTool: "bike",
  runFocus: "auto",
};

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

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

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
  const rounded = Math.round(seconds * 10) / 10;
  const mins = Math.floor(rounded / 60);
  const secs = rounded - mins * 60;
  const whole = Math.floor(secs);
  const tenth = Math.round((secs - whole) * 10) % 10;
  return `${mins}:${String(whole).padStart(2, "0")}.${tenth}${suffix}`;
}

function startOfDay(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 24,
  } as React.CSSProperties,
  container: {
    maxWidth: 1280,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  } as React.CSSProperties,
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
  } as React.CSSProperties,
  cardHeader: {
    padding: "18px 20px 0 20px",
  } as React.CSSProperties,
  cardBody: {
    padding: 20,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.6,
    margin: 0,
  } as React.CSSProperties,
  grid2: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  } as React.CSSProperties,
  grid3: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  } as React.CSSProperties,
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    padding: "4px 0",
  } as React.CSSProperties,
  fieldGroup: {
    display: "grid",
    gap: 8,
  } as React.CSSProperties,
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#334155",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    background: "#ffffff",
  } as React.CSSProperties,
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    background: "#ffffff",
  } as React.CSSProperties,
  switchRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 14,
  } as React.CSSProperties,
  pill: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  } as React.CSSProperties,
  tabBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  } as React.CSSProperties,
  tabButton: (active: boolean) => ({
    padding: "10px 14px",
    borderRadius: 12,
    border: active ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
    background: active ? "#dbeafe" : "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
  }) as React.CSSProperties,
  sessionCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    background: "#ffffff",
  } as React.CSSProperties,
  softBlock: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 14,
  } as React.CSSProperties,
  smallCaps: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 0.08,
    color: "#64748b",
    fontWeight: 700,
    marginBottom: 6,
  } as React.CSSProperties,
  warning: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 14,
    padding: 12,
    fontSize: 12,
  } as React.CSSProperties,
  heroWrap: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.7fr)",
  } as React.CSSProperties,
  heroCard: {
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%)",
    border: "1px solid #bfdbfe",
    borderRadius: 24,
    boxShadow: "0 10px 30px rgba(29, 78, 216, 0.08)",
    padding: 28,
  } as React.CSSProperties,
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.04,
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  heroTitle: {
    fontSize: 40,
    lineHeight: 1.05,
    fontWeight: 800,
    margin: "14px 0 12px 0",
    letterSpacing: "-0.03em",
  } as React.CSSProperties,
  heroText: {
    fontSize: 16,
    color: "#334155",
    lineHeight: 1.7,
    margin: 0,
  } as React.CSSProperties,
  ctaRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  } as React.CSSProperties,
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  } as React.CSSProperties,
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  } as React.CSSProperties,
  heroStats: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    marginTop: 18,
  } as React.CSSProperties,
  statCard: {
    border: "1px solid #dbeafe",
    background: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    padding: 14,
  } as React.CSSProperties,
  featureGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  } as React.CSSProperties,
  featureCard: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: 18,
    padding: 16,
  } as React.CSSProperties,
  featureTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 6,
  } as React.CSSProperties,
  featureText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
    margin: 0,
  } as React.CSSProperties,
  profileBar: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "1.4fr 1fr auto auto auto",
    alignItems: "end",
  } as React.CSSProperties,
  miniButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  destructiveButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#be123c",
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  mobileBuildSection: {
    position: "sticky" as const,
    bottom: 0,
    background: "linear-gradient(180deg, rgba(248,250,252,0.85) 0%, #f8fafc 30%, #f8fafc 100%)",
    paddingTop: 12,
    marginTop: 8,
  } as React.CSSProperties,
  mobileBuildCard: {
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 18,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    padding: 14,
  } as React.CSSProperties,
  mobileBuildText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.5,
    margin: "0 0 10px 0",
  } as React.CSSProperties,
  mobileBuildMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
  } as React.CSSProperties,
};

function SectionCard(props: { title: string; children: React.ReactNode; subtitle?: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.sectionTitle}>{props.title}</h2>
        {props.subtitle ? <p style={{ ...styles.subtitle, marginTop: 6 }}>{props.subtitle}</p> : null}
      </div>
      <div style={styles.cardBody}>{props.children}</div>
    </div>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardBody}>
        <div style={{ fontSize: 14, color: "#64748b" }}>{props.label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{props.value}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("inputs");
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1200;
    return window.innerWidth;
  });
  const [benchmarks, setBenchmarks] = useState<Benchmarks>(() => safeRead(STORAGE_KEYS.currentBenchmarks, defaultBenchmarks));
  const [setup, setSetup] = useState<Setup>(() => safeRead(STORAGE_KEYS.currentSetup, defaultSetup));
  const [profiles, setProfiles] = useState<Profile[]>(() => safeRead(STORAGE_KEYS.profiles, []));
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");
  const [lastBuiltState, setLastBuiltState] = useState<BuildState>(() =>
    safeRead(STORAGE_KEYS.lastBuiltState, {
      benchmarks: safeRead(STORAGE_KEYS.currentBenchmarks, defaultBenchmarks),
      setup: safeRead(STORAGE_KEYS.currentSetup, defaultSetup),
    })
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.currentBenchmarks, JSON.stringify(benchmarks));
  }, [benchmarks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.currentSetup, JSON.stringify(setup));
  }, [setup]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.lastBuiltState, JSON.stringify(lastBuiltState));
  }, [lastBuiltState]);

  const isMobile = viewportWidth < MOBILE_BREAKPOINT;
  const isTablet = viewportWidth >= MOBILE_BREAKPOINT && viewportWidth < TABLET_BREAKPOINT;

  function saveProfile() {
    const trimmed = profileName.trim();
    if (!trimmed) {
      window.alert("Enter a profile name first.");
      return;
    }

    const existing = selectedProfileId ? profiles.find((p) => p.id === selectedProfileId) : undefined;
    const id = existing?.id ?? `profile_${Date.now()}`;

    const nextProfile: Profile = {
      id,
      name: trimmed,
      benchmarks,
      setup,
      updatedAt: new Date().toISOString(),
    };

    setProfiles((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return [nextProfile, ...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
    setSelectedProfileId(id);
  }

  function loadProfile(profileId: string) {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    setBenchmarks(profile.benchmarks);
    setSetup(profile.setup);
    setSelectedProfileId(profile.id);
    setProfileName(profile.name);
    setActiveTab("inputs");
  }

  function createNewProfile() {
    setSelectedProfileId("");
    setProfileName("");
    setBenchmarks(defaultBenchmarks);
    setSetup(defaultSetup);
    setActiveTab("inputs");
  }

  function deleteProfile() {
    if (!selectedProfileId) return;
    const profile = profiles.find((p) => p.id === selectedProfileId);
    const confirmed = window.confirm(`Delete profile${profile ? `: ${profile.name}` : ""}?`);
    if (!confirmed) return;
    setProfiles((prev) => prev.filter((p) => p.id !== selectedProfileId));
    setSelectedProfileId("");
    setProfileName("");
  }

  function buildPlan() {
    setLastBuiltState({ benchmarks, setup });
    setActiveTab("dashboard");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function formatDuration(seconds: number): string {
    const rounded = Math.max(30, Math.round(seconds));
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function shouldReplaceRun(intent: "easy" | "threshold" | "hyrox" | "interval") {
    if (setup.runMode === "none") return true;
    if (setup.runMode === "reduced") return intent === "easy" || intent === "threshold";
    return false;
  }

  function replacementForRun(distanceMeters: number, durationSeconds: number, intent: "easy" | "threshold" | "hyrox" | "interval") {
    const roundedDistance = Math.max(500, Math.round(distanceMeters / 250) * 250);
    const bikeTarget =
      intent === "easy"
        ? Math.round(derived.bikeZones.z2)
        : intent === "interval"
          ? Math.round(derived.bikeZones.vo2)
          : Math.round(derived.bikeZones.threshold);
    const rowSplit =
      intent === "easy"
        ? (derived.rowThreshold ?? 120) + 8
        : intent === "interval"
          ? derived.rowVo2 ?? derived.rowThreshold ?? 120
          : derived.rowThreshold ?? 120;
    const skiSplit =
      intent === "easy"
        ? (derived.skiThreshold ?? 130) + 8
        : intent === "interval"
          ? derived.skiVo2 ?? derived.skiThreshold ?? 130
          : derived.skiThreshold ?? 130;

    if (setup.replacementTool === "bike") {
      return `BikeErg ${formatDuration(durationSeconds)} @ ${bikeTarget} W`;
    }

    if (setup.replacementTool === "row") {
      return `RowErg ${roundedDistance}m @ ${formatSecondsToPace(rowSplit, "/500m")}`;
    }

    if (setup.replacementTool === "ski") {
      return `SkiErg ${roundedDistance}m @ ${formatSecondsToPace(skiSplit, "/500m")}`;
    }

    return `BikeErg ${formatDuration(durationSeconds * 0.5)} @ ${Math.round(intent === "easy" ? derived.bikeZones.z2 : derived.bikeZones.tempo)} W + RowErg ${Math.max(250, Math.round(roundedDistance / 2 / 250) * 250)}m @ ${formatSecondsToPace(intent === "interval" ? rowSplit : derived.rowThreshold ?? 120, "/500m")}`;
  }

  function runPiece(distanceMeters: number, paceSeconds: number | null, intent: "easy" | "threshold" | "hyrox" | "interval") {
    const distanceLabel = distanceMeters >= 1000 ? `${distanceMeters / 1000}km` : `${distanceMeters}m`;
    const estimatedSeconds = paceSeconds ? paceSeconds * (distanceMeters / 1000) : 180;
    const original = `Run ${distanceLabel} @ ${formatSecondsToPace(paceSeconds ?? 0, "/km")}`;
    if (!shouldReplaceRun(intent)) return original;
    return replacementForRun(distanceMeters, estimatedSeconds, intent);
  }

  function aerobicRunAddon() {
    const easyRunDurationMinutes = 20;
    const easyRunSeconds = easyRunDurationMinutes * 60;
    const estimatedDistance = derived.runEasy ? Math.round((easyRunSeconds / derived.runEasy) * 1000) : 3500;

    if (!shouldReplaceRun("easy")) {
      return ` + easy run ${easyRunDurationMinutes}min @ ${formatSecondsToPace(derived.runEasy ?? 0, "/km")}`;
    }

    return ` + ${replacementForRun(estimatedDistance, easyRunSeconds, "easy")}`;
  }

  function createRunDevelopmentSession(phase: string, squatLoad: number, bssLoad: number): Session {
    if (phase === "Phase 1") {
      return {
        day: "Day 4",
        name: "Run Development",
        main: shouldReplaceRun("easy")
          ? replacementForRun(5000, (derived.runEasy ?? 330) * 5, "easy")
          : `Aerobic run 35-45min @ ${formatSecondsToPace(derived.runEasy ?? 0, "/km")}`,
        strength: `Single-leg squat 3x8/leg @ ${Math.max(10, bssLoad * 0.6).toFixed(1)} kg`,
        accessory: `Calf eccentrics 3x15 | Tibialis raises 3x20 | Hip mobility 2x60s/side`,
      };
    }

    if (phase === "Phase 2") {
      return {
        day: "Day 4",
        name: "Run Development",
        main: shouldReplaceRun("threshold")
          ? `5 x ${replacementForRun(800, (derived.runIntervals ?? 270) * 0.8, "threshold")}, 90s rest`
          : `5 x 800m @ ${formatSecondsToPace((derived.runPerKm ?? 0) - 5, "/km")}, 90s rest`,
        strength: `Back Squat 4x4 @ ${(squatLoad * 0.92).toFixed(1)} kg`,
        accessory: `Calf eccentrics 3x15 | Tibialis raises 3x20 | Hip mobility 2x60s/side`,
      };
    }

    if (phase === "Phase 3") {
      return {
        day: "Day 4",
        name: "Run Development",
        main: shouldReplaceRun("hyrox")
          ? `4 rounds: ${replacementForRun(1000, derived.runHyrox ?? 300, "hyrox")}, 75s rest`
          : `4 x 1km @ ${formatSecondsToPace(derived.runHyrox ?? 0, "/km")}, 75s rest`,
        strength: `Bulgarian Split Squat 2x6/leg @ ${(bssLoad * 0.9).toFixed(1)} kg`,
        accessory: `Calf eccentrics 3x12 | Tibialis raises 3x20 | Hip mobility 2x60s/side`,
      };
    }

    return {
      day: "Day 4",
      name: "Run Development",
      main: shouldReplaceRun("threshold")
        ? replacementForRun(3000, (derived.runHyrox ?? 300) * 3, "threshold")
        : `Run 20min easy @ ${formatSecondsToPace(derived.runEasy ?? 0, "/km")}`,
      strength: `Activation only`,
      accessory: `Mobility 10min | Breathing reset 5min`,
    };
  }

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

    let runFocusAuto: Exclude<RunFocus, "auto"> = "balanced";
    if (runPerKm !== null && row2kSplit !== null) {
      const runVsRow = runPerKm - row2kSplit * 2.9;
      if (runVsRow > 18 || (benchmarks.squat5rm >= 125 && runPerKm > 290)) {
        runFocusAuto = "high";
      } else if (runVsRow < -8 && rowWeakness !== null && rowWeakness > 10) {
        runFocusAuto = "low";
      }
    }

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
      runFocusAuto,
    };
  }, [benchmarks]);

  const resolvedRunFocus: Exclude<RunFocus, "auto"> = setup.runFocus === "auto" ? derived.runFocusAuto : setup.runFocus;

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

      const day4Session: Session =
        resolvedRunFocus === "high" && setup.runMode !== "none"
          ? createRunDevelopmentSession(phase, squatLoad, bssLoad)
          : {
              day: "Day 4",
              name: "Ski / Run Threshold",
              main:
                phase === "Phase 1" || phase === "Phase 2"
                  ? `SkiErg 4x5min @ ${formatSecondsToPace(derived.skiThreshold ?? 0, "/500m")}, 2:00 rest`
                  : phase === "Phase 3"
                    ? `Ski 500m @ ${formatSecondsToPace(derived.skiVo2 ?? 0, "/500m")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")}`
                    : `${runPiece(1000, derived.runHyrox, "threshold")} | Row @ ${formatSecondsToPace(derived.rowThreshold ?? 0, "/500m")}`,
              strength:
                phase === "Phase 1"
                  ? `Back Squat 5x5 @ ${squatLoad.toFixed(1)} kg`
                  : phase === "Phase 2"
                    ? `Bulgarian Split Squat 3x8/leg @ ${bssLoad.toFixed(1)} kg`
                    : phase === "Phase 3"
                      ? `Bulgarian Split Squat 3x6/leg @ ${bssLoad.toFixed(1)} kg`
                      : "-",
              accessory: phase === "Taper" ? "Easy activation: band work 2x12 | Breathing 5min" : "Farmer carry 4x20m | Side plank 3x30s/side",
            };

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
              ? `3 rounds: Row 1000m @ ${formatSecondsToPace(derived.rowThreshold ?? 0, "/500m")} + ${runPiece(800, derived.runHyrox, "hyrox")}, rest 2:00`
              : phase === "Phase 2"
                ? `4 rounds: Ski 1000m @ ${formatSecondsToPace(derived.skiThreshold ?? 0, "/500m")} + ${runPiece(1000, derived.runHyrox, "hyrox")} + 20 lunges, rest 2:00`
                : phase === "Phase 3"
                  ? `6 rounds: ${runPiece(1000, derived.runHyrox, "hyrox")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")} + 20 lunges, rest 90s`
                  : `2 rounds: ${runPiece(800, derived.runHyrox, "threshold")} + Ski 500m @ ${formatSecondsToPace(derived.skiVo2 ?? 0, "/500m")}, full recovery`,
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
                : `BikeErg 40min @ ${Math.round(derived.bikeZones.z2)} W${phase === "Phase 2" ? aerobicRunAddon() : ""}`,
          strength: phase === "Taper" ? "-" : `Deadlift ${phase === "Phase 1" ? "5x3" : phase === "Phase 2" ? "4x4" : "4x3"} @ ${deadliftLoad.toFixed(1)} kg`,
          accessory: `Tibialis raises 3x20 | Eccentric calf raises 3x15 | Plank 3x45s`,
        },
        day4Session,
        {
          day: "Day 5",
          name: "Compromised Intervals",
          main:
            phase === "Phase 1"
              ? `6 rounds: Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")} + Ski 500m @ ${formatSecondsToPace(derived.skiVo2 ?? 0, "/500m")}, rest 90s`
              : phase === "Phase 2"
                ? `5 rounds: 20 lunges + ${runPiece(1000, derived.runIntervals, "interval")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")}, rest 90s`
                : phase === "Phase 3"
                  ? `5 rounds: ${runPiece(1000, derived.runHyrox, "hyrox")} + Row 500m @ ${formatSecondsToPace(derived.rowVo2 ?? 0, "/500m")}, rest 90s`
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
          main: "Rest day — no training prescribed",
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
  }, [setup, benchmarks, derived, resolvedRunFocus]);

  const todayWorkout = useMemo(() => {
    if (!setup.startDate) {
      return {
        state: "no_start_date" as const,
        title: "Set your start date",
        description: "Add a valid programme start date to see which workout belongs to today.",
      };
    }

    const start = startOfDay(setup.startDate);
    const today = startOfDay(new Date().toISOString().slice(0, 10));

    if (!start || !today) {
      return {
        state: "invalid" as const,
        title: "Date unavailable",
        description: "The current workout could not be calculated from the dates provided.",
      };
    }

    const dayOffset = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (dayOffset < 0) {
      return {
        state: "before_start" as const,
        title: "Programme has not started yet",
        description: "Your start date is still in the future, so there is no workout assigned for today.",
      };
    }

    const totalTrainingDays = program.totalWeeks * 7;
    if (dayOffset >= totalTrainingDays) {
      return {
        state: "after_plan" as const,
        title: "Programme completed",
        description: "Today falls after the current training block. Update your race date or start a new profile to generate the next block.",
      };
    }

    const weekIndex = Math.floor(dayOffset / 7);
    const dayIndex = dayOffset % 7;
    const week = program.rows[weekIndex];
    const session = week?.sessions[dayIndex];

    if (!week || !session) {
      return {
        state: "invalid" as const,
        title: "Workout unavailable",
        description: "The current workout could not be resolved from the programme structure.",
      };
    }

    return {
      state: "ready" as const,
      week,
      session,
      dayNumber: dayOffset + 1,
      dateLabel: today.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "short",
      }),
    };
  }, [setup.startDate, program]);

  const hasUnbuiltChanges = useMemo(() => {
    return JSON.stringify({ benchmarks, setup }) !== JSON.stringify(lastBuiltState);
  }, [benchmarks, setup, lastBuiltState]);

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

  const heroWrapStyle: React.CSSProperties = {
    ...styles.heroWrap,
    gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr" : "minmax(0, 1.3fr) minmax(320px, 0.7fr)",
  };

  const featureGridStyle: React.CSSProperties = {
    ...styles.featureGrid,
    gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, minmax(0, 1fr))",
  };

  const heroStatsStyle: React.CSSProperties = {
    ...styles.heroStats,
    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
  };

  const profileBarStyle: React.CSSProperties = {
    ...styles.profileBar,
    gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1.4fr 1fr auto auto auto",
    alignItems: isMobile ? "stretch" : "end",
  };

  const grid2Style: React.CSSProperties = {
    ...styles.grid2,
    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))",
  };

  const grid3Style: React.CSSProperties = {
    ...styles.grid3,
    gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(auto-fit, minmax(240px, 1fr))",
  };

  const heroTitleStyle: React.CSSProperties = {
    ...styles.heroTitle,
    fontSize: isMobile ? 22 : isTablet ? 30 : 40,
    lineHeight: isMobile ? 1.02 : 1.05,
    wordBreak: "break-word",
  };

  const heroTextStyle: React.CSSProperties = {
    ...styles.heroText,
    fontSize: isMobile ? 14 : 16,
  };

  const ctaRowStyle: React.CSSProperties = {
    ...styles.ctaRow,
    flexDirection: isMobile ? "column" : "row",
  };

  const pageStyle: React.CSSProperties = {
    ...styles.page,
    padding: isMobile ? 12 : 24,
  };

  const containerStyle: React.CSSProperties = {
    ...styles.container,
    gap: isMobile ? 12 : 16,
  };

  const inputStyle: React.CSSProperties = {
    ...styles.input,
    fontSize: isMobile ? 16 : 14,
  };

  const selectStyle: React.CSSProperties = {
    ...styles.select,
    fontSize: isMobile ? 16 : 14,
  };

  const tabBarStyle: React.CSSProperties = {
    ...styles.tabBar,
    flexWrap: isMobile ? "nowrap" : "wrap",
    overflowX: isMobile ? "auto" : "visible",
    paddingBottom: isMobile ? 4 : 0,
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {!isMobile ? (
          <>
            <div style={heroWrapStyle}>
              <div style={styles.heroCard}>
                <div style={styles.eyebrow}>HYROX performance planning</div>
                <h1 style={heroTitleStyle}>Build a race-ready HYROX programme from your actual benchmarks.</h1>
                <p style={heroTextStyle}>
                  Generate structured training phases, benchmark-driven pacing targets, strength progressions, and a full weekly plan tailored to your fitness, race date, and HYROX goals.
                </p>
                <div style={ctaRowStyle}>
                  <button style={styles.primaryButton} onClick={() => setActiveTab("inputs")}>Build my plan</button>
                  <button style={styles.secondaryButton} onClick={() => setActiveTab("dashboard")}>View performance dashboard</button>
                </div>
                <div style={heroStatsStyle}>
                  <div style={styles.statCard}>
                    <div style={styles.smallCaps}>Inputs</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>10+</div>
                    <div style={styles.featureText}>Benchmarks and strength metrics</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.smallCaps}>Output</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>Full block</div>
                    <div style={styles.featureText}>Date-driven weekly HYROX programming</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.smallCaps}>Focus</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>Race specific</div>
                    <div style={styles.featureText}>Pacing, strength, and hybrid readiness</div>
                  </div>
                </div>
              </div>

              <SectionCard title="Programme Window" subtitle="Your training block updates automatically once you enter a valid start date and race date.">
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={styles.metricRow}><span>Total days</span><strong>{program.totalDays ?? "-"}</strong></div>
                  <div style={styles.metricRow}><span>Total weeks</span><strong>{program.totalDays !== null ? program.totalWeeks : "-"}</strong></div>
                  <div style={styles.metricRow}><span>Phase 1</span><strong>{program.totalDays !== null ? program.phase1Weeks : "-"}</strong></div>
                  <div style={styles.metricRow}><span>Phase 2</span><strong>{program.totalDays !== null ? program.phase2Weeks : "-"}</strong></div>
                  <div style={styles.metricRow}><span>Phase 3</span><strong>{program.totalDays !== null ? program.phase3Weeks : "-"}</strong></div>
                  <div style={styles.metricRow}><span>Taper</span><strong>{program.totalDays !== null ? program.taperWeeks : "-"}</strong></div>
                </div>
              </SectionCard>
            </div>

            <div style={featureGridStyle}>
              <div style={styles.featureCard}>
                <div style={styles.featureTitle}>Benchmark-driven pacing</div>
                <p style={styles.featureText}>Uses your row, ski, run, and FTP numbers to generate more usable training targets.</p>
              </div>
              <div style={styles.featureCard}>
                <div style={styles.featureTitle}>Phase-based loading</div>
                <p style={styles.featureText}>Strength work shifts through build, specific preparation, and taper instead of staying static.</p>
              </div>
              <div style={styles.featureCard}>
                <div style={styles.featureTitle}>HYROX-specific structure</div>
                <p style={styles.featureText}>Each week includes hybrid sessions, erg work, strength, accessory work, and race-relevant fatigue management.</p>
              </div>
            </div>
          </>
        ) : (
          <SectionCard title="Programme Window" subtitle="Enter your dates and benchmarks below, then build your plan.">
            <div style={{ display: "grid", gap: 4 }}>
              <div style={styles.metricRow}><span>Total days</span><strong>{program.totalDays ?? "-"}</strong></div>
              <div style={styles.metricRow}><span>Total weeks</span><strong>{program.totalDays !== null ? program.totalWeeks : "-"}</strong></div>
              <div style={styles.metricRow}><span>Phase 1</span><strong>{program.totalDays !== null ? program.phase1Weeks : "-"}</strong></div>
              <div style={styles.metricRow}><span>Phase 2</span><strong>{program.totalDays !== null ? program.phase2Weeks : "-"}</strong></div>
              <div style={styles.metricRow}><span>Phase 3</span><strong>{program.totalDays !== null ? program.phase3Weeks : "-"}</strong></div>
              <div style={styles.metricRow}><span>Taper</span><strong>{program.totalDays !== null ? program.taperWeeks : "-"}</strong></div>
            </div>
          </SectionCard>
        )}

        <div style={tabBarStyle}>
          <button style={styles.tabButton(activeTab === "today")} onClick={() => setActiveTab("today")}>Today</button>
          <button style={styles.tabButton(activeTab === "inputs")} onClick={() => setActiveTab("inputs")}>Inputs</button>
          <button style={styles.tabButton(activeTab === "dashboard")} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
          <button style={styles.tabButton(activeTab === "plan")} onClick={() => setActiveTab("plan")}>Plan</button>
        </div>

        {activeTab === "today" ? (
          <div style={{ display: "grid", gap: 16 }}>
            {todayWorkout.state === "ready" ? (
              <>
                <SectionCard title="Today's Workout" subtitle={`${todayWorkout.dateLabel} • Week ${todayWorkout.week.week} • ${todayWorkout.week.phase} • ${todayWorkout.session.day}`}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={styles.sessionCard}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, color: "#64748b" }}>Current session</div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{todayWorkout.session.name}</div>
                      </div>
                      <div style={grid3Style}>
                        <div style={styles.softBlock}>
                          <div style={styles.smallCaps}>Main Set</div>
                          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{todayWorkout.session.main || "-"}</div>
                        </div>
                        <div style={styles.softBlock}>
                          <div style={styles.smallCaps}>Strength</div>
                          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{todayWorkout.session.strength || "-"}</div>
                        </div>
                        <div style={styles.softBlock}>
                          <div style={styles.smallCaps}>Accessory</div>
                          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{todayWorkout.session.accessory || "-"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <div style={grid2Style}>
                  <MetricCard label="Today" value={todayWorkout.dateLabel} />
                  <MetricCard label="Training Day" value={`Day ${todayWorkout.dayNumber}`} />
                </div>
              </>
            ) : (
              <SectionCard title="Today's Workout" subtitle={todayWorkout.description}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={styles.softBlock}>
                    <div style={styles.smallCaps}>Status</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{todayWorkout.title}</div>
                  </div>
                  <button style={{ ...styles.primaryButton, width: isMobile ? "100%" : undefined }} onClick={() => setActiveTab("inputs")}>
                    Go to Inputs
                  </button>
                </div>
              </SectionCard>
            )}
          </div>
        ) : null}

        {activeTab === "inputs" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <SectionCard title="Athlete Profiles" subtitle="Profiles are saved in this browser so users can return without re-entering all their benchmark data.">
              <div style={profileBarStyle}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Profile name</label>
                  <input
                    style={inputStyle}
                    value={profileName}
                    placeholder="e.g. Callum - Johannesburg Pro"
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Saved profiles</label>
                  <select
                    style={selectStyle}
                    value={selectedProfileId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedProfileId(nextId);
                      if (nextId) loadProfile(nextId);
                    }}
                  >
                    <option value="">Select a saved profile</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button style={{ ...styles.primaryButton, width: isMobile ? "100%" : undefined }} onClick={saveProfile}>
                  {selectedProfileId ? "Update profile" : "Save profile"}
                </button>
                <button style={{ ...styles.miniButton, width: isMobile ? "100%" : undefined }} onClick={createNewProfile}>New profile</button>
                <button style={{ ...styles.destructiveButton, width: isMobile ? "100%" : undefined, opacity: !selectedProfileId ? 0.6 : 1 }} onClick={deleteProfile} disabled={!selectedProfileId}>Delete</button>
              </div>
            </SectionCard>

            <div style={grid2Style}>
              <SectionCard title="Programme Setup">
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Start date</label>
                    <input style={inputStyle} type="date" value={setup.startDate} onChange={(e) => setSetup((s) => ({ ...s, startDate: e.target.value }))} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Race date</label>
                    <input style={inputStyle} type="date" value={setup.raceDate} onChange={(e) => setSetup((s) => ({ ...s, raceDate: e.target.value }))} />
                  </div>
                  {setup.startDate && setup.raceDate && program.totalDays === null ? (
                    <div style={styles.warning}>Race date must be after the start date.</div>
                  ) : null}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Run Mode</label>
                    <select style={selectStyle} value={setup.runMode} onChange={(e) => setSetup((s) => ({ ...s, runMode: e.target.value as RunMode }))}>
                      <option value="full">Full Running</option>
                      <option value="reduced">Reduced Impact</option>
                      <option value="none">No Running</option>
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Run Focus</label>
                    <select style={selectStyle} value={setup.runFocus} onChange={(e) => setSetup((s) => ({ ...s, runFocus: e.target.value as RunFocus }))}>
                      <option value="auto">Auto</option>
                      <option value="low">Low</option>
                      <option value="balanced">Balanced</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Run Replacement Tool</label>
                    <select style={selectStyle} value={setup.replacementTool} onChange={(e) => setSetup((s) => ({ ...s, replacementTool: e.target.value as ReplacementTool }))}>
                      <option value="bike">BikeErg</option>
                      <option value="row">RowErg</option>
                      <option value="ski">SkiErg</option>
                      <option value="mixed">Mixed Ergs</option>
                    </select>
                  </div>
                  <div style={styles.switchRow}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Include Saturday HYROX class</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Replaces an existing hard hybrid session rather than adding extra load.</div>
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
                <div style={grid3Style}>
                  {inputTimeFields.map(([label, key]) => (
                    <div key={key} style={styles.fieldGroup}>
                      <label style={styles.label}>{label}</label>
                      <input
                        style={inputStyle}
                        value={String(benchmarks[key])}
                        onChange={(e) => setBenchmarks((b) => ({ ...b, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  {inputNumberFields.map(([label, key]) => (
                    <div key={key} style={styles.fieldGroup}>
                      <label style={styles.label}>{label}</label>
                      <input
                        style={inputStyle}
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

            {isMobile && hasUnbuiltChanges ? (
              <div style={styles.mobileBuildSection}>
                <div style={styles.mobileBuildCard}>
                  <div style={styles.mobileBuildMeta}>
                    <span>{setup.startDate ? "Start date set" : "Add start date"}</span>
                    <span>{setup.raceDate ? "Race date set" : "Add race date"}</span>
                  </div>
                  <p style={styles.mobileBuildText}>
                    You have updated your inputs. Build the plan to refresh your dashboard with the latest dates and benchmark values.
                  </p>
                  <button style={{ ...styles.primaryButton, width: "100%" }} onClick={buildPlan}>Build my plan</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "dashboard" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={grid3Style}>
              {benchmarkCards.map((item) => (
                <MetricCard key={item.label} label={item.label} value={item.value} />
              ))}
            </div>

            <div style={grid2Style}>
              <SectionCard title="Weakness Analysis" subtitle={`Run focus: ${setup.runFocus === "auto" ? `Auto • ${derived.runFocusAuto}` : setup.runFocus}`}>
                <div style={{ display: "grid", gap: 10 }}>
                  {derived.weaknessFlags.map((flag, idx) => (
                    <div key={idx} style={{ ...styles.softBlock, border: "1px solid #e2e8f0" }}>{flag}</div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Reference Zones" subtitle={`Run mode: ${setup.runMode === "full" ? "Full Running" : setup.runMode === "reduced" ? `Reduced Impact • ${setup.replacementTool}` : `No Running • ${setup.replacementTool}`}`}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ ...styles.softBlock, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Row VO2</div>
                    <div>{derived.row2kSplit ? `${formatSecondsToPace(derived.row2kSplit - 6, "/500m")} to ${formatSecondsToPace(derived.row2kSplit - 4, "/500m")}` : "-"}</div>
                  </div>
                  <div style={{ ...styles.softBlock, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Row Threshold</div>
                    <div>{derived.row2kSplit ? `${formatSecondsToPace(derived.row2kSplit + 2, "/500m")} to ${formatSecondsToPace(derived.row2kSplit + 4, "/500m")}` : "-"}</div>
                  </div>
                  <div style={{ ...styles.softBlock, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Ski VO2</div>
                    <div>{derived.ski2kSplit ? `${formatSecondsToPace(derived.ski2kSplit - 6, "/500m")} to ${formatSecondsToPace(derived.ski2kSplit - 4, "/500m")}` : "-"}</div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}

        {activeTab === "plan" ? (
          <div style={{ display: "grid", gap: 16 }}>
            {program.rows.map((week) => (
              <div key={week.week} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <h2 style={styles.sectionTitle}>Week {week.week}</h2>
                    <span style={{ ...styles.pill, background: phaseColors[week.phase] }}>{week.phase}</span>
                  </div>
                </div>
                <div style={styles.cardBody}>
                  <div style={{ display: "grid", gap: 12 }}>
                    {week.sessions.map((session) => (
                      <div key={`${week.week}-${session.day}`} style={styles.sessionCard}>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 13, color: "#64748b" }}>{session.day}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{session.name}</div>
                        </div>
                        <div style={grid3Style}>
                          <div style={styles.softBlock}>
                            <div style={styles.smallCaps}>Main Set</div>
                            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{session.main || "-"}</div>
                          </div>
                          <div style={styles.softBlock}>
                            <div style={styles.smallCaps}>Strength</div>
                            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{session.strength || "-"}</div>
                          </div>
                          <div style={styles.softBlock}>
                            <div style={styles.smallCaps}>Accessory</div>
                            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{session.accessory || "-"}</div>
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
      </div>
    </div>
  );
}
