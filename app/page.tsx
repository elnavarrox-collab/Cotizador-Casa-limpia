"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Show, SignInButton, SignUpButton, UserButton, useAuth, useClerk } from "@clerk/nextjs";
import { BrainCircuit, Calculator, Check, CircleAlert, Clock3, Cloud, Copy, History, House, Pencil, Plus, RotateCcw, Save, Settings2, ShieldCheck, Sparkles, Trash2, TrendingUp, WalletCards, X, Zap } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LEGACY_PRICING_KEY, userStorageKey } from "@/lib/client-storage";
import { isMembershipOperational, settingsSchema } from "@/lib/settings-schema";
import { createQuoteSchema, quoteDraftSchema, quoteInputSchema, savedQuoteSchema, type QuoteInput, type SavedQuoteView } from "@/lib/quote-schema";
import { calculateQuote } from "@/lib/pricing";
import { parseTabHash, type AppTab } from "@/lib/navigation";
import { copyText, legacyBrowserCopy } from "@/lib/clipboard";
import { enqueueQuote, readQuoteQueue, removeQueuedQuote } from "@/lib/offline-queue";
import { applyCommercialV4 } from "@/lib/settings-migrations";

type PropertyKey = "department" | "house" | "office";
type ConditionKey = "maintenance" | "normal" | "accumulated" | "deep";
type FrequencyKey = "one" | "four" | "eight" | "twelve";
type QuoteMode = "service" | "membership";
type FlashDiscountPct = 0 | 10 | 20 | 30;
type PlannedDays = 0 | 1 | 2;
type SyncState = "local" | "loading" | "synced" | "error" | "conflict";
type QuoteSaveState = "idle" | "saving" | "saved" | "queued" | "error";
type HistoryState = "idle" | "loading" | "error";
type SavedQuote = SavedQuoteView;
type Addon = { id: string; name: string; price: number; minutes: number };
type Membership = { id: string; line: string; name: string; price: number; visits: number; hours: number; features: string[] };
type Settings = {
  commercial?: import("@/lib/settings-schema").PricingSettings["commercial"];
  schemaVersion: number;
  minimumPrice: number;
  propertyBase: Record<PropertyKey, number>;
  includedSqm: Record<PropertyKey, number>;
  extraSqmPrice: number;
  extraBedroomPrice: number;
  extraBathroomPrice: number;
  conditionPct: Record<ConditionKey, number>;
  frequencyDiscountPct: Record<FrequencyKey, number>;
  urgencyPct: number;
  weekendPct: number;
  workers: number;
  workerHourlyCost: number;
  productivitySqmPerTeamHour: number;
  extraBedroomHours: number;
  extraBathroomHours: number;
  conditionExtraHours: Record<ConditionKey, number>;
  minimumVisitHours: number;
  maxTeamHoursPerDay: number;
  suppliesBaseCost: number;
  suppliesCostPerSqm: number;
  transportCost: number;
  targetMarginPct: number;
  defaultManualAdjustment: number;
  addons: Addon[];
  memberships: Membership[];
};

const RAW_DEFAULT_SETTINGS: Settings = {
  schemaVersion: 3,
  minimumPrice: 42000,
  propertyBase: { department: 42000, house: 55000, office: 60000 },
  includedSqm: { department: 40, house: 60, office: 60 },
  extraSqmPrice: 650,
  extraBedroomPrice: 4000,
  extraBathroomPrice: 8000,
  conditionPct: { maintenance: 0, normal: 15, accumulated: 45, deep: 80 },
  frequencyDiscountPct: { one: 0, four: 10, eight: 15, twelve: 20 },
  urgencyPct: 20,
  weekendPct: 25,
  workers: 2,
  workerHourlyCost: 6000,
  productivitySqmPerTeamHour: 22,
  extraBedroomHours: 0.25,
  extraBathroomHours: 0.5,
  conditionExtraHours: { maintenance: 0, normal: 0.5, accumulated: 1.5, deep: 2.5 },
  minimumVisitHours: 2,
  maxTeamHoursPerDay: 6,
  suppliesBaseCost: 3500,
  suppliesCostPerSqm: 45,
  transportCost: 7000,
  targetMarginPct: 35,
  defaultManualAdjustment: 0,
  addons: [
    { id: "oven", name: "Interior de horno y campana", price: 12000, minutes: 45 },
    { id: "fridge", name: "Interior de refrigerador", price: 10000, minutes: 35 },
    { id: "cabinets", name: "Interior de muebles de cocina", price: 16000, minutes: 60 },
    { id: "windows", name: "Ventanas accesibles", price: 18000, minutes: 60 },
    { id: "balcony", name: "Terraza o balcón", price: 18000, minutes: 45 },
    { id: "party", name: "Limpieza post-fiesta pequeña", price: 30000, minutes: 90 },
    { id: "move", name: "Limpieza pre o post-mudanza", price: 60000, minutes: 120 },
    { id: "ironing", name: "Planchado express, hasta 10 prendas", price: 15000, minutes: 60 },
    { id: "pet", name: "Paseo de mascota, 30 minutos", price: 8000, minutes: 30 },
  ],
  memberships: [
    { id: "home-1", line: "Hogar", name: "Hogar Express 1D / 1B", price: 120000, visits: 4, hours: 0, features: ["4 visitas mensuales", "Hasta 50 m²", "Baños, cocina exterior, pisos, polvo y orden básico"] },
    { id: "home-2", line: "Hogar", name: "Hogar Express 2D / 2B", price: 160000, visits: 4, hours: 0, features: ["4 visitas mensuales", "Entre 51 y 80 m²", "Mantención periódica con checklist"] },
    { id: "home-3", line: "Hogar", name: "Hogar Express 3D+ / Casa", price: 240000, visits: 4, hours: 0, features: ["4 visitas mensuales", "Entre 81 y 130 m²", "Mantención para espacios de mayor tamaño"] },
    { id: "executive", line: "Bienestar", name: "Executive", price: 180000, visits: 4, hours: 16, features: ["16 horas mensuales", "1 visita semanal", "Mantención, planchado, orden y paseo de mascota"] },
    { id: "balance", line: "Bienestar", name: "Balance", price: 320000, visits: 8, hours: 32, features: ["32 horas mensuales", "2 visitas semanales", "Mantención, planchado, meal prep, despensa y mascotas"] },
    { id: "premier", line: "Bienestar", name: "Premier", price: 450000, visits: 12, hours: 48, features: ["48 horas mensuales", "3 visitas semanales", "Limpieza, cocina, lavandería, reposición y mascotas"] },
    { id: "office-2", line: "Empresas", name: "Oficina 2 veces por semana", price: 160000, visits: 8, hours: 0, features: ["Hasta 100 m²", "8 visitas aproximadas al mes", "Escritorios, papeleras, pisos, baños y kitchenette"] },
    { id: "office-5", line: "Empresas", name: "Oficina lunes a viernes", price: 380000, visits: 20, hours: 0, features: ["Hasta 100 m²", "20 visitas aproximadas al mes", "Mantención recurrente de espacios corporativos"] },
  ],
};

const DEFAULT_SETTINGS = applyCommercialV4(RAW_DEFAULT_SETTINGS) as Settings;

const PROPERTY_LABELS: Record<PropertyKey, string> = { department: "Departamento", house: "Casa", office: "Oficina" };
const CONDITION_LABELS: Record<ConditionKey, string> = { maintenance: "Mantención frecuente", normal: "Estado normal", accumulated: "Suciedad acumulada", deep: "Limpieza profunda" };
const FREQUENCY: Record<FrequencyKey, { label: string; visits: number }> = {
  one: { label: "Visita única", visits: 1 },
  four: { label: "4 visitas al mes", visits: 4 },
  eight: { label: "8 visitas al mes", visits: 8 },
  twelve: { label: "12 visitas al mes", visits: 12 },
};
const money = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value || 0);
const displayQuoteName = (quote: SavedQuote) => quote.name?.trim() || `${quote.client || "Cliente sin nombre"} · ${quote.commune} · ${new Intl.DateTimeFormat("es-CL", { dateStyle: "short" }).format(new Date(quote.createdAt))}`;
const normalizeSettings = (raw: Partial<Settings>): Settings => {
  const stored = applyCommercialV4(raw);
  return ({
  ...DEFAULT_SETTINGS,
  ...stored,
  propertyBase: { ...DEFAULT_SETTINGS.propertyBase, ...(stored.propertyBase ?? {}) },
  includedSqm: { ...DEFAULT_SETTINGS.includedSqm, ...(stored.includedSqm ?? {}) },
  conditionPct: { ...DEFAULT_SETTINGS.conditionPct, ...(stored.conditionPct ?? {}) },
  frequencyDiscountPct: { ...DEFAULT_SETTINGS.frequencyDiscountPct, ...(stored.frequencyDiscountPct ?? {}) },
  conditionExtraHours: { ...DEFAULT_SETTINGS.conditionExtraHours, ...(stored.conditionExtraHours ?? {}) },
  addons: Array.isArray(stored.addons) ? stored.addons.map((addon) => ({ ...addon, minutes: stored.schemaVersion && stored.schemaVersion >= 2 && Number.isFinite(addon.minutes) ? addon.minutes : DEFAULT_SETTINGS.addons.find((item) => item.id === addon.id)?.minutes ?? addon.minutes ?? 30 })) : DEFAULT_SETTINGS.addons,
  memberships: Array.isArray(stored.memberships) ? stored.memberships : DEFAULT_SETTINGS.memberships,
  });
};

function NumberField({ label, value, onChange, suffix, min = 0, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; min?: number; max?: number; step?: number }) {
  return <label className="field"><span>{label}</span><div className="number-wrap"><Input type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ""} aria-invalid={!Number.isFinite(value) || value < min || (max !== undefined && value > max)} onChange={(event) => onChange(event.currentTarget.valueAsNumber)} />{suffix ? <small>{suffix}</small> : null}</div></label>;
}

export default function Home() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const { openSignIn } = useClerk();
  const [activeTab, setActiveTab] = useState<AppTab>("quote");
  const [openSettingsSections, setOpenSettingsSections] = useState<string[]>(["pricing"]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsBeforeReset, setSettingsBeforeReset] = useState<Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stateOwnerId, setStateOwnerId] = useState<string | null>(null);
  const [mode, setMode] = useState<QuoteMode>("service");
  const [quoteName, setQuoteName] = useState("");
  const [client, setClient] = useState("");
  const [commune, setCommune] = useState<"Las Condes" | "Providencia">("Las Condes");
  const [property, setProperty] = useState<PropertyKey>("department");
  const [sqm, setSqm] = useState(35);
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [condition, setCondition] = useState<ConditionKey>("normal");
  const [frequency, setFrequency] = useState<FrequencyKey>("one");
  const [serviceType, setServiceType] = useState<"general" | "deep" | "delivery">("general");
  const [assignedWorkers, setAssignedWorkers] = useState(0);
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [flashDiscountPct, setFlashDiscountPct] = useState<FlashDiscountPct>(0);
  const [plannedDays, setPlannedDays] = useState<PlannedDays>(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [membershipId, setMembershipId] = useState(DEFAULT_SETTINGS.memberships[0].id);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [cloudReady, setCloudReady] = useState(false);
  const [allowOfflineSettings, setAllowOfflineSettings] = useState(false);
  const [quoteSaveState, setQuoteSaveState] = useState<QuoteSaveState>("idle");
  const [quoteSaveMessage, setQuoteSaveMessage] = useState("");
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState>("idle");
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingQuoteId, setRenamingQuoteId] = useState<string | null>(null);
  const [renameErrorId, setRenameErrorId] = useState<string | null>(null);
  const pendingSettingsRef = useRef<{ userId: string; body: string } | null>(null);
  const settingsRevisionRef = useRef(0);
  const quoteIntentRef = useRef<string | null>(null);
  const quoteSaveLockRef = useRef(false);

  useEffect(() => {
    if (!authLoaded) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      // The render is gated by stateOwnerId, so values owned by the previous
      // account cannot be displayed during this reset/hydration cycle.
      setLoaded(false);
      setCloudReady(false);
      setAllowOfflineSettings(false);
      setSettings(DEFAULT_SETTINGS);
      setSettingsBeforeReset(null);
      setManualAdjustment(DEFAULT_SETTINGS.defaultManualAdjustment);
      setSavedQuotes([]);
      setHistoryNextCursor(null);
      setHistoryState("idle");
      setQuoteSaveState("idle");
      setQuoteName("");
      setClient("");
      setCommune("Las Condes");
      setMode("service");
      setProperty("department");
      setSqm(35);
      setBedrooms(1);
      setBathrooms(1);
      setCondition("normal");
      setFrequency("one");
      setSelectedAddons([]);
      setServiceType("general"); setAssignedWorkers(0); setAddonQuantities({});
      setUrgent(false);
      setWeekend(false);
      setFlashDiscountPct(0);
      setPlannedDays(0);
      setMembershipId(DEFAULT_SETTINGS.memberships[0].id);
      setEditingQuoteId(null);
      setRenameValue("");
      setSyncState(userId ? "loading" : "local");
      settingsRevisionRef.current = 0;

      if (userId) {
        try {
          const stored = localStorage.getItem(userStorageKey(userId, "pricing"));
          if (stored) {
            const parsed = normalizeSettings(JSON.parse(stored));
            setSettings(parsed);
            setManualAdjustment(parsed.defaultManualAdjustment);
          }
        } catch {
          localStorage.removeItem(userStorageKey(userId, "pricing"));
        }
        try {
          const draft = quoteDraftSchema.safeParse(JSON.parse(localStorage.getItem(userStorageKey(userId, "draft")) ?? "null"));
          if (draft.success) {
            setQuoteName(draft.data.quoteName);
            setClient(draft.data.client);
            setCommune(draft.data.commune);
            setMode(draft.data.input.mode);
            setManualAdjustment(draft.data.input.manualAdjustment ?? Number.NaN);
            if (draft.data.input.mode === "membership") {
              setMembershipId(draft.data.input.membershipId);
            } else {
              setProperty(draft.data.input.property);
              setSqm(draft.data.input.sqm ?? Number.NaN);
              setBedrooms(draft.data.input.bedrooms ?? Number.NaN);
              setBathrooms(draft.data.input.bathrooms ?? Number.NaN);
              setCondition(draft.data.input.condition === "deep" ? "normal" : draft.data.input.condition);
              setServiceType(draft.data.input.serviceType ?? (draft.data.input.condition === "deep" ? "deep" : "general"));
              setAssignedWorkers(draft.data.input.workers ?? 0);
              setAddonQuantities(draft.data.input.addonQuantities ?? {});
              setFrequency(draft.data.input.frequency);
              setSelectedAddons(draft.data.input.selectedAddonIds);
              setUrgent(draft.data.input.urgent);
              setWeekend(draft.data.input.weekend);
              setFlashDiscountPct(draft.data.input.flashDiscountPct);
              setPlannedDays(draft.data.input.plannedDays);
            }
          }
        } catch {
          localStorage.removeItem(userStorageKey(userId, "draft"));
        }
      }

      // The old global key can contain another account's pricing and must
      // never be migrated into a named user automatically.
      localStorage.removeItem(LEGACY_PRICING_KEY);
      setStateOwnerId(userId ?? null);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [authLoaded, userId]);

  useEffect(() => {
    if (loaded && userId) localStorage.setItem(userStorageKey(userId, "pricing"), JSON.stringify(settings));
  }, [settings, loaded, userId]);

  useEffect(() => {
    const syncTabFromLocation = () => setActiveTab(parseTabHash(window.location.hash));
    Promise.resolve().then(syncTabFromLocation);
    window.addEventListener("popstate", syncTabFromLocation);
    window.addEventListener("hashchange", syncTabFromLocation);
    return () => {
      window.removeEventListener("popstate", syncTabFromLocation);
      window.removeEventListener("hashchange", syncTabFromLocation);
    };
  }, []);

  useEffect(() => {
    if (!loaded || !userId) return;
    const nullable = (value: number) => Number.isFinite(value) ? value : null;
    const input = mode === "membership"
      ? { mode, membershipId, manualAdjustment: nullable(manualAdjustment) }
      : { mode, property, sqm: nullable(sqm), bedrooms: nullable(bedrooms), bathrooms: nullable(bathrooms), condition, frequency, serviceType, workers: assignedWorkers || (sqm <= 35 && bedrooms <= 1 && bathrooms <= 1 ? 1 : 2), addonQuantities, selectedAddonIds: selectedAddons, urgent, weekend, flashDiscountPct, plannedDays, manualAdjustment: nullable(manualAdjustment) };
    localStorage.setItem(userStorageKey(userId, "draft"), JSON.stringify({ quoteName, client, commune, input }));
  }, [loaded, userId, quoteName, client, commune, mode, membershipId, manualAdjustment, property, sqm, bedrooms, bathrooms, condition, frequency, selectedAddons, serviceType, assignedWorkers, addonQuantities, urgent, weekend, flashDiscountPct, plannedDays]);

  useEffect(() => {
    if (!authLoaded || !userId) return;
    const controller = new AbortController();

    Promise.resolve().then(() => {
      setSyncState("loading");
      setHistoryState("loading");
      setHistoryMessage("");
    });
    const settingsRequest = fetch("/api/settings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          openSignIn();
          throw new Error("AUTH_REQUIRED");
        }
        if (!response.ok) throw new Error(`settings:${response.status}`);
        const settingsData = await response.json();
        if (settingsData.settings) {
          const parsed = normalizeSettings(settingsData.settings);
          setSettings(parsed);
          setManualAdjustment(parsed.defaultManualAdjustment);
        }
        settingsRevisionRef.current = typeof settingsData.revision === "number" ? settingsData.revision : 0;
        setCloudReady(true);
        setSyncState("synced");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCloudReady(false);
        setSyncState("error");
      });

    const quotesRequest = fetch("/api/quotes", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          openSignIn();
          throw new Error("AUTH_REQUIRED");
        }
        if (!response.ok) throw new Error(`quotes:${response.status}`);
        const quotesData = await response.json();
        const validQuotes = Array.isArray(quotesData.quotes)
          ? quotesData.quotes.flatMap((quote: unknown) => {
              const parsed = savedQuoteSchema.safeParse(quote);
              return parsed.success ? [parsed.data] : [];
            })
          : [];
        setSavedQuotes(validQuotes);
        setHistoryNextCursor(typeof quotesData.nextCursor === "string" ? quotesData.nextCursor : null);
        setHistoryState("idle");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHistoryState("error");
        setHistoryMessage("No se pudo cargar el historial. La configuración puede seguir sincronizándose.");
      });

    void Promise.allSettled([settingsRequest, quotesRequest]);

    return () => controller.abort();
  }, [authLoaded, userId, syncAttempt, openSignIn]);

  useEffect(() => {
    if (!loaded || !userId || (!cloudReady && !allowOfflineSettings)) return;
    if (!settingsSchema.safeParse(settings).success) {
      Promise.resolve().then(() => setSyncState("error"));
      return;
    }
    const body = JSON.stringify({ settings, baseRevision: settingsRevisionRef.current });
    pendingSettingsRef.current = { userId, body };
    const saveTimer = window.setTimeout(() => {
      setSyncState("loading");
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }).then(async (response) => {
        if (response.status === 401) {
          openSignIn();
          setSyncState("error");
          return null;
        }
        if (response.status === 409) {
          setSyncState("conflict");
          return null;
        }
        if (!response.ok) throw new Error("save");
        return response.json();
      }).then((data) => {
        if (!data) return;
        if (pendingSettingsRef.current?.body === body) pendingSettingsRef.current = null;
        if (typeof data.revision === "number") settingsRevisionRef.current = data.revision;
        setSyncState("synced");
      }).catch(() => setSyncState("error"));
    }, 700);
    return () => window.clearTimeout(saveTimer);
  }, [settings, loaded, userId, cloudReady, allowOfflineSettings, openSignIn]);

  useEffect(() => {
    const flushPendingSettings = () => {
      const pending = pendingSettingsRef.current;
      if (!pending || pending.userId !== userId) return;
      void fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: pending.body,
        keepalive: true,
      });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushPendingSettings();
    };
    window.addEventListener("pagehide", flushPendingSettings);
    window.addEventListener("online", flushPendingSettings);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", flushPendingSettings);
      window.removeEventListener("online", flushPendingSettings);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId]);

  useEffect(() => {
    if (!loaded || !userId) return;
    const queueKey = userStorageKey(userId, "quote-queue");
    let flushing = false;
    const flushQuotes = async () => {
      if (flushing || !navigator.onLine) return;
      flushing = true;
      try {
        for (const queued of readQuoteQueue(localStorage, queueKey)) {
          const response = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(queued) });
          if (response.status === 401) {
            openSignIn();
            break;
          }
          if (!response.ok) break;
          removeQueuedQuote(localStorage, queueKey, queued.idempotencyKey);
        }
        if (readQuoteQueue(localStorage, queueKey).length === 0) {
          setQuoteSaveState((state) => state === "queued" ? "saved" : state);
          setQuoteSaveMessage((message) => message.includes("quedó en cola") ? "La cotización pendiente se sincronizó correctamente." : message);
        }
      } finally {
        flushing = false;
      }
    };
    window.addEventListener("online", flushQuotes);
    void flushQuotes();
    return () => window.removeEventListener("online", flushQuotes);
  }, [loaded, userId, openSignIn]);

  const membership = settings.memberships.find((plan) => plan.id === membershipId) ?? settings.memberships[0];
  const membershipConfigured = mode !== "membership" || isMembershipOperational(membership);
  const quoteInput: QuoteInput = mode === "membership"
    ? { mode, membershipId, manualAdjustment }
    : { mode, property, sqm, bedrooms, bathrooms, condition, frequency, serviceType, workers: assignedWorkers || (sqm <= 35 && bedrooms <= 1 && bathrooms <= 1 ? 1 : 2), addonQuantities, selectedAddonIds: selectedAddons, urgent, weekend, flashDiscountPct, plannedDays, manualAdjustment };
  const quoteInputValidation = quoteInputSchema.safeParse(quoteInput);
  const quoteInputValid = quoteInputValidation.success && membershipConfigured;
  const calculationInput: QuoteInput = membershipConfigured
    ? quoteInput
    : { mode: "service", property: "department", sqm: 1, bedrooms: 0, bathrooms: 0, condition: "maintenance", frequency: "one", selectedAddonIds: [], urgent: false, weekend: false, flashDiscountPct: 0, plannedDays: 0, manualAdjustment: 0 };
  const result = calculateQuote(calculationInput, settings);

  const priceExplanation = settings.commercial ? "Tarifa por paquete y adicionales. Los costos no elevan automáticamente el precio: revisa el objetivo antes de confirmar. Impuestos y tiempos reales pendientes de definición." : result.priceBasis === "mínimo rentable"
    ? `El precio según alcance es ${money(result.tariff)}, pero no alcanza la rentabilidad objetivo. Por eso, el precio normal para el cliente se fijó en el mínimo rentable de ${money(result.priceBeforeDiscount)}.`
    : result.priceBasis === "precio mínimo configurado"
      ? `El precio normal para el cliente se fijó en el mínimo configurado de ${money(result.priceBeforeDiscount)}.`
      : `El precio según alcance de ${money(result.tariff)} supera el mínimo rentable de ${money(result.minimumProfitable)}, por lo que el trabajo es factible antes de aplicar promociones.`;
  const flashDiscountExplanation = flashDiscountPct === 0 ? "" : `El ${flashDiscountPct}% se aplicó directamente sobre el precio normal para el cliente de ${money(result.priceBeforeDiscount)}. Se descontaron ${money(result.flashDiscount)} y el nuevo precio final es ${money(result.finalPrice)}.`;

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value, ...(current.commercial && ["workerHourlyCost","suppliesBaseCost","suppliesCostPerSqm","transportCost","workers","productivitySqmPerTeamHour"].includes(key) ? {commercial: {...current.commercial, costsConfirmed:false}} : {}) }));
  const resetSettings = () => {
    if (!window.confirm("¿Restablecer todos los precios, costos, adicionales y membresías? Podrás deshacerlo mientras esta página siga abierta.")) return;
    setSettingsBeforeReset(settings);
    setSettings(DEFAULT_SETTINGS);
    setManualAdjustment(DEFAULT_SETTINGS.defaultManualAdjustment);
    if (userId) localStorage.removeItem(userStorageKey(userId, "pricing"));
  };
  const undoSettingsReset = () => {
    if (!settingsBeforeReset) return;
    setSettings(settingsBeforeReset);
    setManualAdjustment(settingsBeforeReset.defaultManualAdjustment);
    setSettingsBeforeReset(null);
  };
  const navigateToTab = (tab: AppTab) => {
    setActiveTab(tab);
    if (window.location.hash !== `#${tab}`) window.history.pushState(null, "", `#${tab}`);
  };
  const addAddon = () => {
    const addon: Addon = { id: `custom-${crypto.randomUUID()}`, name: "Nuevo servicio adicional", price: 0, minutes: 30 };
    updateSetting("addons", [...settings.addons, addon]);
  };
  const removeAddon = (id: string) => {
    const addon = settings.addons.find((item) => item.id === id);
    if (!addon || !window.confirm(`¿Eliminar “${addon.name}”? Esta acción modificará los cálculos futuros.`)) return;
    updateSetting("addons", settings.addons.filter((addon) => addon.id !== id));
    setSelectedAddons((current) => current.filter((selected) => selected !== id));
  };
  const openAddonSettings = () => {
    navigateToTab("settings");
    setOpenSettingsSections((current) => current.includes("addons") ? current : [...current, "addons"]);
    window.setTimeout(() => document.getElementById("additional-services-settings")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const addAndOpenAddon = () => {
    addAddon();
    openAddonSettings();
  };
  const quoteText = useMemo(() => {
    const heading = client ? `Cotización para ${client}` : "Cotización Casa Limpia";
    if (mode === "membership") return `${heading}\nPlan: ${membership.name}\nCobertura: ${commune}\n${membership.features.join("\n")}\nPrecio para el cliente: ${money(result.finalPrice)} mensuales\nValor sujeto a confirmación de antecedentes del servicio.`;
    const addonNames = settings.addons.filter((item) => selectedAddons.includes(item.id) && item.id !== "move" && !(serviceType === "delivery" && ["cabinets", "balcony"].includes(item.id))).map((item) => `${item.name} × ${addonQuantities[item.id] ?? 1}`);
    return `${heading}\nComuna: ${commune}\nPropiedad: ${PROPERTY_LABELS[property]}, ${sqm} m², ${bedrooms} dormitorio(s), ${bathrooms} baño(s)\nModalidad: ${serviceType === "delivery" ? "Entrega (vacío)" : serviceType === "deep" ? "Profunda" : "General"}\nEquipo: ${result.assignedWorkers} persona(s)\nAlcance: ${result.scope}\nEstado: ${CONDITION_LABELS[condition]}\nFrecuencia: ${FREQUENCY[frequency].label}${addonNames.length ? `\nAdicionales: ${addonNames.join(", ")}` : ""}\nPlanificación por visita: ${result.daysPerVisit} jornada(s) de ${result.dailyHours.toFixed(1)} horas cada una\nTiempo total por visita: ${result.hoursPerVisit.toFixed(1)} horas${result.actualSavings > 0 ? `\nAhorro promocional aplicado: ${money(result.actualSavings)}` : ""}\nPrecio para el cliente: ${money(result.finalPrice)}\n${result.needsReview ? "Cotización preliminar: solicitar fotos y confirmar el alcance antes de agendar.\n" : ""}Incluye productos básicos. El cliente debe disponer de aspiradora en buen estado cuando se requiera. Valor sujeto a confirmación del estado real de la propiedad.`;
  }, [client, mode, membership, commune, result.finalPrice, result.hoursPerVisit, result.daysPerVisit, result.dailyHours, result.needsReview, result.actualSavings, settings.addons, selectedAddons, property, sqm, bedrooms, bathrooms, condition, frequency, serviceType, addonQuantities, result.assignedWorkers, result.scope]);
  const copyQuote = async () => {
    if (!quoteInputValid) return;
    setCopyMessage("");
    try {
      await copyText(quoteText, navigator.clipboard, legacyBrowserCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyMessage("No se pudo copiar automáticamente. Revisa los permisos del portapapeles e inténtalo nuevamente.");
    }
  };
  const saveQuote = async () => {
    if (!quoteInputValid) {
      setQuoteSaveState("error");
      setQuoteSaveMessage("Corrige los campos marcados antes de guardar.");
      return;
    }
    if (quoteSaveLockRef.current) return;
    quoteSaveLockRef.current = true;
    quoteIntentRef.current ??= crypto.randomUUID();
    const quotePayload = {
      idempotencyKey: quoteIntentRef.current,
      name: quoteName,
      client,
      commune,
      mode,
      input: quoteInput,
      summary: quoteText,
    };
    setQuoteSaveState("saving");
    setQuoteSaveMessage("");
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotePayload),
      });
      const saved = await response.json().catch(() => ({ message: "El servidor devolvió una respuesta inválida." }));
      if (response.status === 401) {
        openSignIn();
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente; el borrador se conservará.");
      }
      if (!response.ok) throw new Error(saved.message || `No se pudo guardar (${response.status}).`);
      const savedQuote = savedQuoteSchema.parse(saved.quote);
      setSavedQuotes((current) => [savedQuote, ...current.filter((quote) => quote._id !== savedQuote._id)].slice(0, 100));
      setQuoteSaveState("saved");
      quoteIntentRef.current = null;
      window.setTimeout(() => setQuoteSaveState("idle"), 2000);
    } catch (error) {
      if (userId && (!navigator.onLine || error instanceof TypeError)) {
        enqueueQuote(localStorage, userStorageKey(userId, "quote-queue"), createQuoteSchema.parse(quotePayload));
        setQuoteSaveState("queued");
        setQuoteSaveMessage("Sin conexión: la cotización quedó en cola y se enviará automáticamente al recuperar internet.");
        quoteIntentRef.current = null;
      } else {
        setQuoteSaveState("error");
        setQuoteSaveMessage(error instanceof Error ? error.message : "No se pudo guardar. Revisa tu sesión y conexión, y vuelve a intentarlo.");
      }
    } finally {
      quoteSaveLockRef.current = false;
    }
  };
  const fetchQuotesPage = async (cursor?: string) => {
    setHistoryState("loading");
    setHistoryMessage("");
    try {
      const query = new URLSearchParams({ limit: "25" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/quotes?${query}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        openSignIn();
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente para recuperar el historial.");
      }
      if (!response.ok) throw new Error(data.message || "No se pudo cargar el historial.");
      const validQuotes = Array.isArray(data.quotes)
        ? data.quotes.flatMap((quote: unknown) => {
            const parsed = savedQuoteSchema.safeParse(quote);
            return parsed.success ? [parsed.data] : [];
          })
        : [];
      setSavedQuotes((current) => cursor ? [...current, ...validQuotes.filter((quote: SavedQuote) => !current.some((existing) => existing._id === quote._id))] : validQuotes);
      setHistoryNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
      setHistoryState("idle");
    } catch (error) {
      setHistoryState("error");
      setHistoryMessage(error instanceof Error ? error.message : "No se pudo cargar el historial.");
    }
  };
  const refreshQuotes = () => void fetchQuotesPage();
  const startQuoteRename = (quote: SavedQuote) => {
    setEditingQuoteId(quote._id);
    setRenameValue(displayQuoteName(quote));
    setRenameErrorId(null);
  };
  const cancelQuoteRename = () => {
    setEditingQuoteId(null);
    setRenameValue("");
    setRenameErrorId(null);
  };
  const renameQuote = async (id: string) => {
    const name = renameValue.trim();
    if (!name) {
      setRenameErrorId(id);
      return;
    }
    setRenamingQuoteId(id);
    setRenameErrorId(null);
    try {
      const response = await fetch("/api/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      if (response.status === 401) {
        openSignIn();
        throw new Error("AUTH_REQUIRED");
      }
      if (!response.ok) throw new Error("rename");
      setSavedQuotes((current) => current.map((quote) => quote._id === id ? { ...quote, name } : quote));
      setEditingQuoteId(null);
      setRenameValue("");
    } catch {
      setRenameErrorId(id);
    } finally {
      setRenamingQuoteId(null);
    }
  };

  if (userId && stateOwnerId !== userId) {
    return <main className="app-shell"><section className="auth-gate" role="status" aria-live="polite"><Cloud /><h2>Cargando los datos de esta cuenta…</h2></section></main>;
  }
  if (userId && !cloudReady && !allowOfflineSettings) {
    return <main className="app-shell"><section className="auth-gate" role={syncState === "error" ? "alert" : "status"} aria-live="polite"><Cloud /><h2>{syncState === "error" ? "No se pudo cargar la configuración remota" : "Cargando configuración segura…"}</h2><p>{syncState === "error" ? "El cotizador permanece bloqueado para evitar calcular con precios incompletos o antiguos." : "Espera antes de crear una cotización."}</p>{syncState === "error" ? <div className="auth-gate-actions"><Button onClick={() => setSyncAttempt((attempt) => attempt + 1)}>Reintentar conexión</Button><Button variant="outline" onClick={() => setAllowOfflineSettings(true)}>Usar copia local bajo mi responsabilidad</Button></div> : null}</section></main>;
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><House /><Sparkles /></div>
      <div><p>Casa Limpia</p><h1>Cotizador operativo</h1></div>
      <div className="topbar-actions">
        <div className="coverage"><span /> Las Condes y Providencia</div>
        <Show when="signed-out">
          <SignInButton mode="modal"><button className="auth-link">Iniciar sesión</button></SignInButton>
          <SignUpButton mode="modal"><button className="auth-primary">Crear cuenta</button></SignUpButton>
        </Show>
        <Show when="signed-in"><UserButton showName /></Show>
      </div>
    </header>
    <Show when="signed-out">
      <section className="auth-gate">
        <div className="auth-gate-icon"><ShieldCheck /></div>
        <p className="eyebrow">Acceso seguro</p>
        <h2>Ingresa para administrar las cotizaciones de Casa Limpia.</h2>
        <p>Tu cuenta protege las configuraciones, los precios y el historial del negocio.</p>
        <div className="auth-gate-actions">
          <SignInButton mode="modal"><button className="auth-primary">Iniciar sesión</button></SignInButton>
          <SignUpButton mode="modal"><button className="auth-link">Crear mi primera cuenta</button></SignUpButton>
        </div>
      </section>
    </Show>
    <Show when="signed-in">
    <Tabs value={activeTab} onValueChange={(value) => navigateToTab(value as AppTab)} className="workspace">
      <TabsList className="main-tabs">
        <TabsTrigger value="quote"><Calculator /> Cotizador</TabsTrigger>
        <TabsTrigger value="memberships"><WalletCards /> Membresías</TabsTrigger>
        <TabsTrigger value="history"><History /> Historial</TabsTrigger>
        <TabsTrigger value="settings"><Settings2 /> Configuraciones</TabsTrigger>
      </TabsList>

      <TabsContent value="quote" className="tab-panel">
        <section className="intro-row"><div><p className="eyebrow">Motor inteligente de cotización</p><h2>Precio, capacidad y rentabilidad en una sola vista.</h2><p>Calcula el valor, estima jornadas y detecta cuándo conviene pedir fotografías antes de confirmar.</p></div><div className={`save-chip ${syncState}`}><Cloud /> {syncState === "synced" ? "Configuración sincronizada" : syncState === "loading" ? "Sincronizando…" : syncState === "conflict" ? "Cambios en otra sesión" : syncState === "error" ? "Falló la sincronización" : "Respaldo local activo"}{syncState === "error" || syncState === "conflict" ? <Button type="button" size="xs" variant="outline" onClick={() => setSyncAttempt((attempt) => attempt + 1)}>{syncState === "conflict" ? "Cargar versión remota" : "Reintentar"}</Button> : null}</div></section>
        <div className="quote-grid">
          <section className="panel form-panel">
            <div className="mode-switch" role="group" aria-label="Tipo de cotización"><button className={mode === "service" ? "active" : ""} onClick={() => setMode("service")}>Servicio personalizado</button><button className={mode === "membership" ? "active" : ""} onClick={() => setMode("membership")}>Membresía</button></div>
            <div className="form-grid two">
              <label className="field quote-name-field"><span>Nombre de la cotización</span><Input value={quoteName} onChange={(e) => setQuoteName(e.target.value)} maxLength={140} placeholder="Ej. Limpieza departamento Catalina" /></label>
              <label className="field"><span>Nombre del cliente</span><Input value={client} onChange={(e) => setClient(e.target.value)} maxLength={140} placeholder="Ej. Catalina Pérez" /></label>
              <label className="field"><span>Comuna</span><Select value={commune} onValueChange={(value) => setCommune(value as "Las Condes" | "Providencia")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Las Condes">Las Condes</SelectItem><SelectItem value="Providencia">Providencia</SelectItem></SelectContent></Select></label>
            </div>
            {mode === "membership" ? <div className="membership-picker">
              <label className="field"><span>Plan</span><Select value={membershipId} onValueChange={setMembershipId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{settings.memberships.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.line} · {plan.name}</SelectItem>)}</SelectContent></Select></label>
              <div className="selected-plan"><p>{membership.line}</p><h3>{membership.name}</h3><strong>{money(membership.price)} / mes</strong><ul>{membership.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul></div>
              <NumberField label="Ajuste manual final" value={manualAdjustment} onChange={setManualAdjustment} suffix="CLP" min={-1000000} step={1000} />
            </div> : <>
              <div className="section-label"><span>1</span> Propiedad</div>
              <div className="form-grid three">
                <label className="field"><span>Tipo</span><Select value={property} onValueChange={(value) => setProperty(value as PropertyKey)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PROPERTY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label>
                <NumberField label="Superficie" value={sqm} onChange={setSqm} suffix="m²" min={1} max={10000} step={0.5} />
                <label className="field"><span>Estado</span><Select value={condition} onValueChange={(value) => setCondition(value as ConditionKey)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CONDITION_LABELS).filter(([key]) => key !== "deep").map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label>
                <label className="field"><span>Modalidad</span><select value={serviceType} onChange={e => setServiceType(e.target.value as typeof serviceType)}><option value="general">General</option><option value="deep">Profunda</option><option value="delivery">Entrega / mudanza (propiedad vacía)</option></select></label>
                <label className="field"><span>Personas en esta visita</span><select value={assignedWorkers} onChange={e => setAssignedWorkers(Number(e.target.value))}><option value={0}>Automático según propiedad</option><option value={1}>1 persona</option><option value={2}>2 personas</option></select></label>
                <NumberField label="Dormitorios" value={bedrooms} onChange={setBedrooms} max={100} />
                <NumberField label="Baños" value={bathrooms} onChange={setBathrooms} max={100} />
                <label className="field"><span>Frecuencia</span><Select value={frequency} onValueChange={(value) => setFrequency(value as FrequencyKey)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FREQUENCY).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select></label>
              </div>
              <div className="section-label"><span>2</span> Planificación del servicio</div>
              <div className="schedule-planner">
                <label className="field schedule-select"><span>Cantidad de jornadas por visita</span><Select value={String(plannedDays)} onValueChange={(value) => setPlannedDays(Number(value) as PlannedDays)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Automático · {result.requiredDaysPerVisit} día(s)</SelectItem><SelectItem value="1">Realizar en 1 día</SelectItem><SelectItem value="2">Realizar en 2 días</SelectItem></SelectContent></Select></label>
                <div><span>Horas totales por visita</span><strong>{result.hoursPerVisit.toFixed(1)} h</strong></div>
                <div><span>Horas estimadas cada día</span><strong>{result.dailyHours.toFixed(1)} h</strong></div>
                <div><span>Jornadas planificadas</span><strong>{result.daysPerVisit} día{result.daysPerVisit === 1 ? "" : "s"}</strong></div>
              </div>
              {result.scheduleOverridden ? <div className="schedule-warning"><CircleAlert /><span>La propiedad requiere al menos {result.requiredDaysPerVisit} jornadas. El sistema mantuvo ese mínimo para no planificar más horas de las permitidas por día.</span></div> : null}
              <div className="section-label-row">
                <div className="section-label"><span>3</span> Adicionales</div>
                <div className="addon-actions">
                  <Button type="button" variant="outline" size="sm" onClick={openAddonSettings}><Settings2 /> Editar o eliminar</Button>
                  <Button type="button" size="sm" onClick={addAndOpenAddon}><Plus /> Agregar servicio</Button>
                </div>
              </div>
              <p>{result.packageName} · {result.assignedWorkers} persona(s). {result.scope}</p>
              <div className="addon-grid">{settings.addons.filter(a => a.id !== "move").map((addon) => {
                const included = serviceType === "delivery" && ["cabinets", "balcony"].includes(addon.id);
                const checked = selectedAddons.includes(addon.id);
                return <div key={addon.id} className={`addon-card ${checked ? "selected" : ""}`}>
                  <label><Checkbox disabled={included} checked={included || checked} onCheckedChange={(value) => setSelectedAddons(current => value ? [...new Set([...current, addon.id])] : current.filter(id => id !== addon.id))} /> {addon.name} · {included ? "Incluido en entrega" : money(addon.price)}</label>
                  {checked && !included ? <NumberField label={`Cantidad · ${addon.name}`} value={addonQuantities[addon.id] ?? 1} onChange={value => setAddonQuantities(current => ({...current, [addon.id]: value}))} min={1} max={100} /> : null}
                </div>;
              })}</div>
              <div className="section-label"><span>4</span> Condiciones comerciales</div>
              <div className="option-row">
                <label><Checkbox checked={urgent} onCheckedChange={(value) => setUrgent(Boolean(value))} /><span>Servicio urgente<strong>+{settings.urgencyPct}%</strong></span></label>
                <label><Checkbox checked={weekend} onCheckedChange={(value) => setWeekend(Boolean(value))} /><span>Fin de semana o festivo<strong>+{settings.weekendPct}%</strong></span></label>
                <label className={`field flash-discount ${flashDiscountPct ? "active" : ""}`}><span><Zap /> Descuento relámpago</span><Select value={String(flashDiscountPct)} onValueChange={(value) => setFlashDiscountPct(Number(value) as FlashDiscountPct)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Sin descuento</SelectItem><SelectItem value="10">10% relámpago</SelectItem><SelectItem value="20">20% relámpago</SelectItem><SelectItem value="30">30% relámpago</SelectItem></SelectContent></Select></label>
                <NumberField label="Ajuste manual" value={manualAdjustment} onChange={setManualAdjustment} suffix="CLP" min={-1000000} step={1000} />
              </div>
            </>}
            {!quoteInputValidation.success ? <div className="warning profitability" role="alert"><CircleAlert /><span>Revisa los datos: superficie mayor que cero; dormitorios y baños enteros no negativos; ajustes dentro del límite permitido.</span></div> : null}
          </section>
          <aside className="result-panel">
            <p className="eyebrow">Resultado recomendado</p>
            {!quoteInputValid ? <div className="warning profitability" role="alert"><CircleAlert /><span><strong>Cotización incompleta.</strong> {mode === "membership" ? "Configura horas mensuales mayores que cero antes de calcular este plan." : "Corrige los campos inválidos antes de calcular, copiar o guardar. No se mostrarán importes basados en datos incompletos."}</span></div> : <>
            <div className="final-price"><span>Precio preliminar para confirmar</span><strong>{money(result.finalPrice)}</strong><small>{mode === "membership" ? "valor mensual" : result.visits > 1 ? `valor total por ${result.visits} visitas` : "valor por servicio"}</small>{result.actualSavings > 0 ? <small className="promo-saving">Antes <s>{money(result.finalPrice + result.actualSavings)}</s> · ahorro {money(result.actualSavings)}</small> : null}<em><Check /> Este es el único precio que se envía al cliente</em></div>
            <div className="price-explanation"><strong>Evaluación del trabajo</strong><p>{priceExplanation}</p></div>
            {flashDiscountPct > 0 ? <div className={`flash-note ${result.isProfitable ? "applied" : "limited"}`}><Zap /><span><strong>Descuento relámpago aplicado al precio final</strong>{flashDiscountExplanation} {result.financialsPending ? "Rentabilidad pendiente de costos." : !result.isProfitable ? `Advertencia: después del descuento, el precio queda ${money(result.minimumProfitable - result.finalPrice)} bajo el mínimo rentable.` : "El servicio continúa siendo rentable después del descuento."}</span></div> : null}
            <div className="metrics"><div><Clock3 /><span>Horas totales<strong>{result.hours.toFixed(1)} h</strong></span></div><div><WalletCards /><span>Costo estimado<strong>{result.financialsPending ? "Por definir" : money(result.cost)}</strong></span></div><div className={!result.isProfitable ? "metric-risk" : ""}><ShieldCheck /><span>Margen estimado<strong>{result.financialsPending ? "Pendiente" : `${result.margin.toFixed(1)}%`}</strong></span></div><div className={!result.isProfitable ? "metric-risk" : ""}><TrendingUp /><span>Utilidad tras remunerar trabajo<strong>{result.financialsPending ? "Pendiente" : money(result.profit)}</strong></span></div></div>
            <div className={`intelligence-card ${result.needsReview ? "review" : "ready"}`}>
              <div className="intelligence-title"><BrainCircuit /><strong>Análisis operativo</strong></div>
              <div className="intelligence-grid"><span>Complejidad<strong>{result.complexity}</strong></span><span>Confianza<strong>{result.confidence}</strong></span><span>Jornadas / visita<strong>{result.daysPerVisit}</strong></span><span>Horas / día<strong>{result.dailyHours.toFixed(1)} h</strong></span></div>
              <p>{result.recommendation}</p><p>Horas-persona: {result.personHours.toFixed(1)} h · Personal: {result.assignedWorkers} · Capacidad teórica: hasta {result.dailyCapacity} propiedades/día (sin traslado).</p><p>Disponible para ustedes: {result.financialsPending ? "pendiente de gastos" : money(result.takeHome)} · Por hora-persona: {result.financialsPending ? "pendiente" : money(result.effectiveHourlyPay)} · Objetivo total: {money(result.targetTakeHome)}</p>
            </div>
            <details className="breakdown-details">
              <summary><span>Ver cálculo interno detallado</span><small>No se envía al cliente</small></summary>
              <div className="breakdown">
              <div><span>Tarifa base / plan</span><strong>{money(result.base)}</strong></div>
              {mode === "service" ? <><div><span>Tamaño adicional</span><strong>{money(result.sizeExtra)}</strong></div><div><span>Dormitorios y baños</span><strong>{money(result.roomExtra)}</strong></div><div><span>Estado de la propiedad</span><strong>{money(result.conditionExtra)}</strong></div><div><span>Servicios adicionales</span><strong>{money(result.addons)}</strong></div><div><span>Urgencia / fin de semana</span><strong>{money(result.urgency + result.weekend)}</strong></div><div className="discount"><span>Descuento por frecuencia</span><strong>− {money(result.discount)}</strong></div></> : null}
              <div><span>Ajuste manual</span><strong>{money(manualAdjustment)}</strong></div>
              <div className={`subtotal ${result.tariff >= result.minimumProfitable ? "viable" : "not-viable"}`}><span>Precio según alcance <small>Referencia interna · {result.financialsPending ? "COSTOS PENDIENTES" : result.tariff >= result.minimumProfitable ? "CUBRE OBJETIVO" : "BAJO OBJETIVO"}</small></span><strong>{money(result.tariff)}</strong></div>
              {mode === "service" && result.extraDayCost > 0 ? <div className="operational"><span>Costo por jornadas adicionales <small>Traslado e insumos incluidos en el costo estimado</small></span><strong>{money(result.extraDayCost)}</strong></div> : null}
              <div className="floor"><span>Mínimo rentable <small>Control interno</small></span><strong>{result.financialsPending ? "Pendiente" : money(result.minimumProfitable)}</strong></div>
              <div className="chosen"><span>Precio normal para el cliente <small>Antes del descuento relámpago · basado en {result.priceBasis}</small></span><strong>{money(result.priceBeforeDiscount)}</strong></div>
              <div className="discount flash"><span>Descuento relámpago <small>{flashDiscountPct}% sobre el precio normal</small></span><strong>− {money(result.flashDiscount)}</strong></div>
              <div className="client-total"><span>Precio para el cliente</span><strong>{money(result.finalPrice)}</strong></div>
              </div>
            </details>
            {result.needsReview ? <div className="warning"><CircleAlert /><span>Este servicio requiere validación previa. El precio debe confirmarse después de revisar fotos, alcance y accesibilidad.</span></div> : null}
            {!result.isProfitable ? <div className="warning profitability"><ShieldCheck /><span>{result.financialsPending ? "No se puede confirmar rentabilidad: define y verifica remuneración, productos, traslado, estacionamiento y otros gastos en Configuración." : "El precio no cubre el costo, margen u objetivo disponible para ustedes. Revisa el precio antes de confirmar."}</span></div> : <div className="success"><Check /><span>El precio final cubre el costo y el margen configurado.</span></div>}
            <div className="result-actions">
              <Button className="save-quote-button" onClick={saveQuote} disabled={quoteSaveState === "saving" || quoteSaveState === "queued" || !quoteInputValid}>{quoteSaveState === "saved" || quoteSaveState === "queued" ? <Check /> : <Save />}{quoteSaveState === "saving" ? "Guardando…" : quoteSaveState === "saved" ? "Cotización guardada" : quoteSaveState === "queued" ? "Guardado pendiente" : quoteSaveState === "error" ? "Reintentar guardado" : "Guardar cotización"}</Button>
              <Button className="copy-button" onClick={copyQuote} disabled={!quoteInputValid}>{copied ? <Check /> : <Copy />}{copied ? "Cotización copiada" : "Copiar resumen para WhatsApp"}</Button>
            </div>
            {quoteSaveMessage ? <p className="quote-rename-error" role="alert">{quoteSaveMessage}</p> : null}
            {copyMessage ? <p className="quote-rename-error" role="alert">{copyMessage}</p> : null}
            <p className="fine-print">Valor sujeto a confirmación visual del estado real. Productos básicos incluidos. El cliente aporta aspiradora en buen estado cuando sea necesaria.</p>
            </>}
          </aside>
        </div>
      </TabsContent>

      <TabsContent value="memberships" className="tab-panel">
        <section className="intro-row"><div><p className="eyebrow">Planes recurrentes</p><h2>Membresías y suscripciones</h2><p>Características extraídas del documento y precios editables directamente en cada plan.</p></div></section>
        <div className="membership-groups">{["Hogar", "Bienestar", "Empresas"].map((line) => <section key={line} className="membership-section">
          <div className="line-heading"><span>{line === "Hogar" ? "01" : line === "Bienestar" ? "02" : "03"}</span><div><h3>Casa Limpia · {line}</h3><p>{line === "Hogar" ? "Mantención residencial recurrente" : line === "Bienestar" ? "Asistencia doméstica y estilo de vida" : "Limpieza recurrente para oficinas"}</p></div></div>
          <div className="plan-grid">{settings.memberships.filter((plan) => plan.line === line).map((plan) => <article className="plan-card" key={plan.id}>
            <div className="plan-top"><div><p>{plan.visits} visitas / mes</p><h4>{plan.name}</h4></div><Sparkles /></div>
            <label className="editable-price"><span>Precio mensual editable</span><Input type="number" step={1000} value={plan.price} onChange={(e) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, price: Number(e.target.value) } : item))} /></label>
            <ul>{plan.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul>
            {plan.hours <= 0 ? <div className="warning" role="status"><CircleAlert /><span>Configura las horas mensuales para habilitar este plan.</span></div> : null}
            <Button variant="outline" disabled={plan.hours <= 0} onClick={() => { setMembershipId(plan.id); setMode("membership"); document.querySelector<HTMLButtonElement>('[data-slot="tabs-trigger"][value="quote"]')?.click(); }}>Usar en cotización</Button>
          </article>)}</div>
        </section>)}</div>
        <div className="policy-note"><ShieldCheck /><div><strong>Condiciones reales configuradas</strong><p>Cobertura actual: Las Condes y Providencia. Se incluyen productos básicos de limpieza. Cuando se necesite aspirado, el cliente debe disponer de una aspiradora en buen estado. Los servicios de alimentación, cuidado de mascotas y cobros automáticos deben activarse solo cuando Casa Limpia tenga la capacidad operativa necesaria.</p></div></div>
      </TabsContent>

      <TabsContent value="history" className="tab-panel">
        <section className="intro-row">
          <div><p className="eyebrow">Registro comercial</p><h2>Historial de cotizaciones</h2><p>Consulta y pagina todas las cotizaciones guardadas por esta cuenta.</p></div>
          <Button variant="outline" onClick={refreshQuotes} disabled={historyState === "loading"}><History /> {historyState === "loading" ? "Cargando…" : "Actualizar historial"}</Button>
        </section>
        {historyState === "error" ? <div className="warning profitability" role="alert"><CircleAlert /><span>{historyMessage}</span><Button size="sm" variant="outline" onClick={refreshQuotes}>Reintentar</Button></div> : null}
        {savedQuotes.length ? <div className="quote-history">
          {savedQuotes.map((quote) => <article className="quote-history-card" key={quote._id}>
            <div className="quote-history-head"><div className="quote-history-title"><span>{quote.mode === "membership" ? "Membresía" : "Servicio"}</span>{editingQuoteId === quote._id ? <div className="quote-rename"><Input autoFocus aria-label="Nuevo nombre de la cotización" value={renameValue} maxLength={140} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameQuote(quote._id); if (event.key === "Escape") cancelQuoteRename(); }} /><Button size="icon-sm" aria-label="Guardar nuevo nombre" disabled={renamingQuoteId === quote._id} onClick={() => void renameQuote(quote._id)}><Check /></Button><Button size="icon-sm" variant="outline" aria-label="Cancelar cambio de nombre" disabled={renamingQuoteId === quote._id} onClick={cancelQuoteRename}><X /></Button></div> : <div className="quote-title-line"><h3>{displayQuoteName(quote)}</h3><Button size="xs" variant="ghost" onClick={() => startQuoteRename(quote)}><Pencil /> Renombrar</Button></div>}<p>Cliente: {quote.client || "Sin nombre"} · {quote.commune} · {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(quote.createdAt))}</p>{renameErrorId === quote._id ? <small className="quote-rename-error">Escribe un nombre válido e inténtalo nuevamente.</small> : null}</div><strong>{money(quote.finalPrice)}</strong></div>
            <div className="quote-history-metrics"><span>Precio normal <strong>{money(quote.normalPrice)}</strong></span><span>Costo <strong>{quote.financialsPending ? "Pendiente" : money(quote.cost)}</strong></span><span>Margen <strong>{quote.financialsPending ? "Pendiente" : `${quote.margin.toFixed(1)}%`}</strong></span><span className={quote.isProfitable ? "profitable" : "risk"}>{quote.financialsPending ? "Costos pendientes" : quote.isProfitable ? "Rentable" : "Bajo objetivo"}</span></div>
            <details><summary>Ver resumen entregable</summary><pre>{quote.summary}</pre></details>
          </article>)}
          {historyNextCursor ? <Button variant="outline" disabled={historyState === "loading"} onClick={() => void fetchQuotesPage(historyNextCursor)}>{historyState === "loading" ? "Cargando…" : "Cargar más"}</Button> : null}
        </div> : historyState !== "loading" ? <div className="empty-history"><History /><h3>Aún no hay cotizaciones guardadas</h3><p>Genera una cotización y presiona “Guardar cotización”.</p></div> : <div className="empty-history" role="status"><Cloud /><p>Cargando historial…</p></div>}
      </TabsContent>

      <TabsContent value="settings" className="tab-panel">
        <section className="intro-row"><div><p className="eyebrow">Control total</p><h2>Configuración completa del cotizador</h2><p>Todos los números que alimentan el panel lateral se definen aquí y se actualizan inmediatamente.</p></div><div className="result-actions">{settingsBeforeReset ? <Button variant="outline" onClick={undoSettingsReset}>Deshacer restablecimiento</Button> : null}<Button variant="outline" onClick={resetSettings}><RotateCcw /> Restablecer valores</Button></div></section>
        <Accordion type="multiple" value={openSettingsSections} onValueChange={setOpenSettingsSections} className="settings-accordion">
          <AccordionItem value="pricing" className="settings-card"><AccordionTrigger><span><strong>Tarifas base y tamaño</strong><small>Bases provisionales para casas/oficinas. Departamentos usan la tabla de paquetes</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            <NumberField label="Precio mínimo" value={settings.minimumPrice} onChange={(v) => updateSetting("minimumPrice", v)} suffix="CLP" step={1000} />
            {(Object.keys(PROPERTY_LABELS) as PropertyKey[]).filter(key => key !== "department").map((key) => <NumberField key={key} label={`Base ${PROPERTY_LABELS[key]}`} value={settings.propertyBase[key]} onChange={(v) => updateSetting("propertyBase", { ...settings.propertyBase, [key]: v })} suffix="CLP" step={1000} />)}
            {(Object.keys(PROPERTY_LABELS) as PropertyKey[]).filter(key => key !== "department").map((key) => <NumberField key={`${key}-sqm`} label={`m² incluidos · ${PROPERTY_LABELS[key]}`} value={settings.includedSqm[key]} onChange={(v) => updateSetting("includedSqm", { ...settings.includedSqm, [key]: v })} suffix="m²" />)}
            <NumberField label="m² fuera de tabla (estimación)" value={settings.extraSqmPrice} onChange={v => updateSetting("extraSqmPrice", v)} />
          </div></AccordionContent></AccordionItem>

          <AccordionItem value="rules" className="settings-card"><AccordionTrigger><span><strong>Estado, frecuencia y recargos</strong><small>Porcentajes comerciales aplicados automáticamente</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            {(Object.keys(FREQUENCY) as FrequencyKey[]).map((key) => <NumberField key={key} label={`Descuento · ${FREQUENCY[key].label}`} value={settings.frequencyDiscountPct[key]} onChange={(v) => updateSetting("frequencyDiscountPct", { ...settings.frequencyDiscountPct, [key]: v })} suffix="%" />)}
            <NumberField label="Recargo urgente" value={settings.urgencyPct} onChange={(v) => updateSetting("urgencyPct", v)} suffix="%" /><NumberField label="Recargo fin de semana" value={settings.weekendPct} onChange={(v) => updateSetting("weekendPct", v)} suffix="%" />
          </div></AccordionContent></AccordionItem>

          <AccordionItem value="capacity" className="settings-card"><AccordionTrigger><span><strong>Capacidad y tiempo del equipo</strong><small>Horas reales, productividad y límite diario antes de dividir el servicio</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            <NumberField label="Personas del equipo de referencia" value={settings.workers} onChange={(v) => updateSetting("workers", v)} min={1} max={20} /><NumberField label="Rendimiento estimado del equipo de referencia" value={settings.productivitySqmPerTeamHour} onChange={(v) => updateSetting("productivitySqmPerTeamHour", v)} suffix="m²/h" min={0.1} max={1000} /><NumberField label="Horas mínimas por visita" value={settings.minimumVisitHours} onChange={(v) => updateSetting("minimumVisitHours", v)} suffix="h" step={0.5} min={0.5} max={48} /><NumberField label="Máximo de horas por jornada" value={settings.maxTeamHoursPerDay} onChange={(v) => updateSetting("maxTeamHoursPerDay", v)} suffix="h" step={0.5} min={1} max={24} />
            <NumberField label="Horas por dormitorio adicional" value={settings.extraBedroomHours} onChange={(v) => updateSetting("extraBedroomHours", v)} suffix="h" step={0.25} /><NumberField label="Horas por baño adicional" value={settings.extraBathroomHours} onChange={(v) => updateSetting("extraBathroomHours", v)} suffix="h" step={0.25} />
            {(Object.keys(CONDITION_LABELS) as ConditionKey[]).map((key) => <NumberField key={`hours-${key}`} label={`Horas extra · ${CONDITION_LABELS[key]}`} value={settings.conditionExtraHours[key]} onChange={(v) => updateSetting("conditionExtraHours", { ...settings.conditionExtraHours, [key]: v })} suffix="h" step={0.25} />)}
          </div></AccordionContent></AccordionItem>

          {settings.commercial ? <AccordionItem value="commercial" className="settings-card"><AccordionTrigger>Paquetes por tipología y costos pendientes</AccordionTrigger><AccordionContent>
            <p>Precios preliminares con productos incluidos. Meta inicial: $20.000 en total para ustedes después de gastos; no es utilidad adicional al pago de su tiempo. Máximo dos propiedades diarias. Impuestos pendientes de definición.</p>
            {settings.commercial.packages.map((p, index) => <div className="form-grid four" key={p.id}><strong>{p.name} · hasta {p.sqm} m²</strong>{(["general","deep","delivery"] as const).map(key => p[key] === null ? <span key={key}>Entrega: cotización previa</span> : <NumberField key={key} label={key === "general" ? "General" : key === "deep" ? "Profunda" : "Entrega"} value={p[key]!} onChange={value => updateSetting("commercial", {...settings.commercial!, packages: settings.commercial!.packages.map((item,i) => i === index ? {...item,[key]:value} : item)})} />)}</div>)}
            <div className="form-grid four">{(["targetTakeHome","parkingCost","otherCost"] as const).map(key => <NumberField key={key} label={key === "targetTakeHome" ? "Objetivo total para ustedes / visita" : key === "parkingCost" ? "Estacionamiento / jornada" : "Otros gastos / jornada"} value={settings.commercial![key]} onChange={value => updateSetting("commercial", {...settings.commercial!,[key]:value, costsConfirmed:false})} />)}</div>
            <label><input type="checkbox" checked={settings.commercial.costsConfirmed} onChange={e => updateSetting("commercial", {...settings.commercial!, costsConfirmed:e.target.checked})} /> He verificado todos los gastos y el valor del trabajo por hora. Los importes cero son intencionales.</label>
          </AccordionContent></AccordionItem> : null}
          <AccordionItem value="costs" className="settings-card"><AccordionTrigger><span><strong>Costos y margen</strong><small>Evaluación de rentabilidad y precio normal recomendado</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            <NumberField label="Costo por persona/hora" value={settings.workerHourlyCost} onChange={(v) => updateSetting("workerHourlyCost", v)} suffix="CLP" step={500} max={100000000} /><NumberField label="Costo base de insumos" value={settings.suppliesBaseCost} onChange={(v) => updateSetting("suppliesBaseCost", v)} suffix="CLP" step={500} max={100000000} /><NumberField label="Insumos por m²" value={settings.suppliesCostPerSqm} onChange={(v) => updateSetting("suppliesCostPerSqm", v)} suffix="CLP" step={5} max={100000000} /><NumberField label="Traslado por jornada" value={settings.transportCost} onChange={(v) => updateSetting("transportCost", v)} suffix="CLP" step={500} max={100000000} /><NumberField label="Margen objetivo" value={settings.targetMarginPct} onChange={(v) => updateSetting("targetMarginPct", v)} suffix="%" max={95} /><NumberField label="Ajuste manual predeterminado" value={settings.defaultManualAdjustment} onChange={(v) => { updateSetting("defaultManualAdjustment", v); setManualAdjustment(v); }} suffix="CLP" step={1000} min={-1000000} max={10000000} />
          </div></AccordionContent></AccordionItem>

          <AccordionItem value="addons" className="settings-card" id="additional-services-settings"><AccordionTrigger><span><strong>Servicios adicionales</strong><small>Nombre, precio y minutos que cada servicio suma al cálculo</small></span></AccordionTrigger><AccordionContent>
            <div className="settings-section-head"><p>Los cambios se reflejan inmediatamente en el cotizador y en el análisis operativo.</p><Button onClick={addAddon}><Plus /> Agregar servicio</Button></div>
            <div className="addon-table-scroll" role="region" aria-label="Servicios adicionales editables" tabIndex={0}>
              <table className="addon-table">
                <thead><tr><th scope="col">Nombre</th><th scope="col">Valor <small>(CLP)</small></th><th scope="col">Tiempo estimado <small>(min)</small></th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>{settings.addons.map((addon, index) => <tr key={addon.id}>
                  <td><Input aria-label={`Nombre del servicio ${index + 1}`} title={addon.name} value={addon.name} onChange={(e) => updateSetting("addons", settings.addons.map((item) => item.id === addon.id ? { ...item, name: e.target.value } : item))} /></td>
                  <td><Input type="number" aria-label={`Valor en CLP de ${addon.name || "servicio " + (index + 1)}`} min={0} max={100000000} step={1000} value={Number.isFinite(addon.price) ? addon.price : ""} aria-invalid={!Number.isFinite(addon.price) || addon.price < 0 || addon.price > 100000000} onChange={(e) => updateSetting("addons", settings.addons.map(item => item.id === addon.id ? { ...item, price: e.currentTarget.valueAsNumber } : item))} /></td>
                  <td><Input type="number" aria-label={`Tiempo en minutos de ${addon.name || "servicio " + (index + 1)}`} min={0} max={10000} step={5} value={Number.isFinite(addon.minutes) ? addon.minutes : ""} aria-invalid={!Number.isFinite(addon.minutes) || addon.minutes < 0 || addon.minutes > 10000} onChange={(e) => updateSetting("addons", settings.addons.map(item => item.id === addon.id ? { ...item, minutes: e.currentTarget.valueAsNumber } : item))} /></td>
                  <td><Button variant="ghost" size="icon-sm" className="addon-table-delete" title={`Eliminar ${addon.name}`} aria-label={`Eliminar ${addon.name}`} onClick={() => removeAddon(addon.id)}><Trash2 /></Button></td>
                </tr>)}</tbody>
              </table>
            </div>
            {settings.addons.length === 0 ? <div className="empty-addons"><p>No hay servicios adicionales configurados.</p><Button variant="outline" onClick={addAddon}><Plus /> Crear el primero</Button></div> : null}
          </AccordionContent></AccordionItem>

          <AccordionItem value="memberships" className="settings-card"><AccordionTrigger><span><strong>Membresías y suscripciones</strong><small>Precio, visitas, horas mensuales y características de cada plan</small></span></AccordionTrigger><AccordionContent><div className="membership-config-grid">{settings.memberships.map((plan) => <article className="membership-config-card" key={plan.id}><div className="membership-config-title"><span>{plan.line}</span><strong>{plan.name}</strong></div><div className="form-grid two"><label className="field"><span>Nombre del plan</span><Input value={plan.name} onChange={(e) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, name: e.target.value } : item))} /></label><NumberField label="Precio mensual" value={plan.price} onChange={(value) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, price: value } : item))} suffix="CLP" step={1000} /><NumberField label="Visitas mensuales" value={plan.visits} onChange={(value) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, visits: value } : item))} /><NumberField label="Horas mensuales" value={plan.hours} min={0.25} step={0.25} onChange={(value) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, hours: value } : item))} suffix="h" /></div>{plan.hours <= 0 ? <small className="quote-rename-error" role="alert">Este plan no puede cotizarse ni guardarse hasta definir horas mensuales mayores que cero.</small> : null}<label className="field"><span>Características, una por línea</span><Textarea value={plan.features.join("\n")} onChange={(e) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, features: e.target.value.split("\n").filter((feature) => feature.trim()) } : item))} /></label></article>)}</div></AccordionContent></AccordionItem>
        </Accordion>
        <section className="formula-card"><Calculator /><div><h3>Motor de cálculo avanzado</h3><p><strong>Precio según alcance:</strong> paquete por tipología y modalidad + adicionales por cantidad + recargos − descuento por frecuencia. Tamaño, dormitorios y baños incluidos no se cobran nuevamente. Fuera de tabla: evaluación previa.</p><p><strong>Capacidad:</strong> estima las horas totales y permite planificar 1 o 2 jornadas. Las horas se reparten entre los días y se incorporan los costos de cada jornada.</p><p><strong>Precio final:</strong> el descuento relámpago se aplica al precio de tabla. No se eleva automáticamente para cubrir costos. La rentabilidad permanece pendiente hasta verificar los gastos y la remuneración.</p></div></section>
      </TabsContent>
    </Tabs>
    </Show>
  </main>;
}
