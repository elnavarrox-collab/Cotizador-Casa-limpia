"use client";

import { useEffect, useMemo, useState } from "react";
import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { BrainCircuit, Calculator, Check, CircleAlert, Clock3, Cloud, Copy, History, House, Plus, RotateCcw, Save, Settings2, ShieldCheck, Sparkles, Trash2, TrendingUp, WalletCards, Zap } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PropertyKey = "department" | "house" | "office";
type ConditionKey = "maintenance" | "normal" | "accumulated" | "deep";
type FrequencyKey = "one" | "four" | "eight" | "twelve";
type QuoteMode = "service" | "membership";
type FlashDiscountPct = 0 | 10 | 20 | 30;
type PlannedDays = 0 | 1 | 2;
type SyncState = "local" | "loading" | "synced" | "error";
type QuoteSaveState = "idle" | "saving" | "saved" | "error";
type SavedQuote = { _id: string; client: string; commune: string; mode: QuoteMode; summary: string; finalPrice: number; normalPrice: number; cost: number; margin: number; isProfitable: boolean; createdAt: string };
type Addon = { id: string; name: string; price: number; minutes: number };
type Membership = { id: string; line: string; name: string; price: number; visits: number; hours: number; features: string[] };
type Settings = {
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

const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 2,
  minimumPrice: 35000,
  propertyBase: { department: 35000, house: 45000, office: 50000 },
  includedSqm: { department: 40, house: 60, office: 60 },
  extraSqmPrice: 650,
  extraBedroomPrice: 4000,
  extraBathroomPrice: 6000,
  conditionPct: { maintenance: 0, normal: 15, accumulated: 35, deep: 60 },
  frequencyDiscountPct: { one: 0, four: 10, eight: 15, twelve: 18 },
  urgencyPct: 20,
  weekendPct: 10,
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
    { id: "cabinets", name: "Interior de muebles de cocina", price: 12000, minutes: 60 },
    { id: "windows", name: "Ventanas accesibles", price: 15000, minutes: 60 },
    { id: "balcony", name: "Terraza o balcón", price: 15000, minutes: 45 },
    { id: "party", name: "Limpieza post-fiesta pequeña", price: 20000, minutes: 90 },
    { id: "move", name: "Limpieza pre o post-mudanza", price: 30000, minutes: 120 },
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

const PROPERTY_LABELS: Record<PropertyKey, string> = { department: "Departamento", house: "Casa", office: "Oficina" };
const CONDITION_LABELS: Record<ConditionKey, string> = { maintenance: "Mantención frecuente", normal: "Estado normal", accumulated: "Suciedad acumulada", deep: "Limpieza profunda" };
const FREQUENCY: Record<FrequencyKey, { label: string; visits: number }> = {
  one: { label: "Visita única", visits: 1 },
  four: { label: "4 visitas al mes", visits: 4 },
  eight: { label: "8 visitas al mes", visits: 8 },
  twelve: { label: "12 visitas al mes", visits: 12 },
};
const money = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value || 0);
const normalizeSettings = (stored: Partial<Settings>): Settings => ({
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

function NumberField({ label, value, onChange, suffix, min = 0, step = 1 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; min?: number; step?: number }) {
  return <label className="field"><span>{label}</span><div className="number-wrap"><Input type="number" min={min} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />{suffix ? <small>{suffix}</small> : null}</div></label>;
}

export default function Home() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const [activeTab, setActiveTab] = useState("quote");
  const [openSettingsSections, setOpenSettingsSections] = useState<string[]>(["pricing"]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<QuoteMode>("service");
  const [client, setClient] = useState("");
  const [commune, setCommune] = useState("Las Condes");
  const [property, setProperty] = useState<PropertyKey>("department");
  const [sqm, setSqm] = useState(50);
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [condition, setCondition] = useState<ConditionKey>("normal");
  const [frequency, setFrequency] = useState<FrequencyKey>("one");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [flashDiscountPct, setFlashDiscountPct] = useState<FlashDiscountPct>(0);
  const [plannedDays, setPlannedDays] = useState<PlannedDays>(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [membershipId, setMembershipId] = useState(DEFAULT_SETTINGS.memberships[0].id);
  const [copied, setCopied] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [cloudReady, setCloudReady] = useState(false);
  const [quoteSaveState, setQuoteSaveState] = useState<QuoteSaveState>("idle");
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("casa-limpia-pricing-v1");
        if (stored) {
          const parsed = normalizeSettings(JSON.parse(stored));
          setSettings(parsed);
          setManualAdjustment(parsed.defaultManualAdjustment);
        } else {
          setManualAdjustment(DEFAULT_SETTINGS.defaultManualAdjustment);
        }
      } catch {}
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem("casa-limpia-pricing-v1", JSON.stringify(settings));
  }, [settings, loaded]);

  useEffect(() => {
    if (!authLoaded || !userId) return;
    const controller = new AbortController();

    Promise.resolve().then(() => setSyncState("loading"));
    Promise.all([
      fetch("/api/settings", { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("settings"))),
      fetch("/api/quotes", { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("quotes"))),
    ]).then(([settingsData, quotesData]) => {
      if (settingsData.settings) {
        const parsed = normalizeSettings(settingsData.settings);
        setSettings(parsed);
        setManualAdjustment(parsed.defaultManualAdjustment);
      }
      setSavedQuotes(Array.isArray(quotesData.quotes) ? quotesData.quotes : []);
      setCloudReady(true);
      setSyncState("synced");
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSyncState("error");
    });

    return () => controller.abort();
  }, [authLoaded, userId]);

  useEffect(() => {
    if (!loaded || !userId || !cloudReady) return;
    const saveTimer = window.setTimeout(() => {
      setSyncState("loading");
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }).then((response) => {
        if (!response.ok) throw new Error("save");
        setSyncState("synced");
      }).catch(() => setSyncState("error"));
    }, 700);
    return () => window.clearTimeout(saveTimer);
  }, [settings, loaded, userId, cloudReady]);

  const membership = settings.memberships.find((plan) => plan.id === membershipId) ?? settings.memberships[0];
  const result = useMemo(() => {
    if (mode === "membership") {
      const cost = membership.hours * settings.workerHourlyCost + membership.visits * (settings.suppliesBaseCost + settings.transportCost);
      const minimumProfitable = settings.targetMarginPct >= 100 ? cost : cost / (1 - settings.targetMarginPct / 100);
      const tariff = membership.price + manualAdjustment;
      const priceBeforeDiscount = Math.max(tariff, minimumProfitable, settings.minimumPrice);
      const priceBasis = minimumProfitable >= tariff && minimumProfitable >= settings.minimumPrice ? "mínimo rentable" : settings.minimumPrice >= tariff ? "precio mínimo configurado" : "precio del plan";
      const finalPrice = priceBeforeDiscount;
      const hoursPerVisit = membership.visits ? membership.hours / membership.visits : 0;
      return { base: membership.price, sizeExtra: 0, roomExtra: 0, conditionExtra: 0, addons: 0, urgency: 0, weekend: 0, discount: 0, flashDiscount: 0, actualSavings: 0, tariff, hours: membership.hours, hoursPerVisit, dailyHours: hoursPerVisit, daysPerVisit: 1, requiredDaysPerVisit: 1, scheduleOverridden: false, serviceDays: membership.visits, extraDayCost: 0, cost, minimumProfitable, priceBeforeDiscount, priceBasis, finalPrice, isProfitable: finalPrice >= minimumProfitable, margin: finalPrice ? ((finalPrice - cost) / finalPrice) * 100 : 0, profit: finalPrice - cost, visits: membership.visits, complexity: "Plan", confidence: "Alta", needsReview: false, recommendation: "Plan recurrente listo para presentar." };
    }
    const visits = FREQUENCY[frequency].visits;
    const base = settings.propertyBase[property];
    const sizeExtra = Math.max(0, sqm - settings.includedSqm[property]) * settings.extraSqmPrice;
    const roomExtra = Math.max(0, bedrooms - 1) * settings.extraBedroomPrice + Math.max(0, bathrooms - 1) * settings.extraBathroomPrice;
    const beforeCondition = base + sizeExtra + roomExtra;
    const conditionExtra = beforeCondition * settings.conditionPct[condition] / 100;
    const activeAddons = settings.addons.filter((addon) => selectedAddons.includes(addon.id));
    const addons = activeAddons.reduce((sum, addon) => sum + addon.price, 0);
    const addonHours = activeAddons.reduce((sum, addon) => sum + addon.minutes / 60, 0);
    const visitSubtotal = beforeCondition + conditionExtra + addons;
    const urgency = urgent ? visitSubtotal * settings.urgencyPct / 100 : 0;
    const weekendCharge = weekend ? visitSubtotal * settings.weekendPct / 100 : 0;
    const gross = (visitSubtotal + urgency + weekendCharge) * visits;
    const discount = gross * settings.frequencyDiscountPct[frequency] / 100;
    const tariff = gross - discount + manualAdjustment;
    const hoursPerVisit = Math.max(settings.minimumVisitHours, sqm / Math.max(1, settings.productivitySqmPerTeamHour) + Math.max(0, bedrooms - 1) * settings.extraBedroomHours + Math.max(0, bathrooms - 1) * settings.extraBathroomHours + settings.conditionExtraHours[condition] + addonHours);
    const requiredDaysPerVisit = Math.max(1, Math.ceil(hoursPerVisit / Math.max(1, settings.maxTeamHoursPerDay)));
    const daysPerVisit = plannedDays === 0 ? requiredDaysPerVisit : Math.max(requiredDaysPerVisit, plannedDays);
    const scheduleOverridden = plannedDays > 0 && plannedDays < requiredDaysPerVisit;
    const dailyHours = hoursPerVisit / daysPerVisit;
    const serviceDays = daysPerVisit * visits;
    const extraDayCost = (settings.suppliesBaseCost + sqm * settings.suppliesCostPerSqm + settings.transportCost) * Math.max(0, daysPerVisit - 1) * visits;
    const cost = (hoursPerVisit * settings.workers * settings.workerHourlyCost + (settings.suppliesBaseCost + sqm * settings.suppliesCostPerSqm) * daysPerVisit + settings.transportCost * daysPerVisit) * visits;
    const minimumProfitable = settings.targetMarginPct >= 100 ? cost : cost / (1 - settings.targetMarginPct / 100);
    const priceBeforeDiscount = Math.max(tariff, minimumProfitable, settings.minimumPrice);
    const priceBasis = minimumProfitable >= tariff && minimumProfitable >= settings.minimumPrice ? "mínimo rentable" : settings.minimumPrice >= tariff ? "precio mínimo configurado" : "precio según alcance";
    const flashDiscount = priceBeforeDiscount * flashDiscountPct / 100;
    const finalPrice = Math.max(0, priceBeforeDiscount - flashDiscount);
    const actualSavings = flashDiscount;
    const isProfitable = finalPrice >= minimumProfitable;
    const conditionWeight: Record<ConditionKey, number> = { maintenance: 0, normal: 1, accumulated: 3, deep: 5 };
    const complexityScore = conditionWeight[condition] + (sqm > 120 ? 3 : sqm > 80 ? 2 : sqm > 50 ? 1 : 0) + (bathrooms > 2 ? 1 : 0) + (activeAddons.length >= 3 ? 2 : activeAddons.length ? 1 : 0) + (urgent ? 1 : 0);
    const complexity = complexityScore >= 7 ? "Alta" : complexityScore >= 4 ? "Media" : "Baja";
    const needsReview = condition === "deep" || condition === "accumulated" || requiredDaysPerVisit > 1 || sqm > 150;
    const confidence = condition === "deep" || sqm > 180 ? "Baja" : needsReview ? "Media" : "Alta";
    const recommendation = daysPerVisit > 1 ? `Servicio planificado en ${daysPerVisit} jornadas de ${dailyHours.toFixed(1)} horas cada una.` : needsReview ? "Solicitar fotos antes de confirmar el valor." : "Cotización apta para confirmar con revisión final.";
    return { base, sizeExtra, roomExtra, conditionExtra, addons, urgency, weekend: weekendCharge, discount, flashDiscount, actualSavings, tariff, hours: hoursPerVisit * visits, hoursPerVisit, dailyHours, daysPerVisit, requiredDaysPerVisit, scheduleOverridden, serviceDays, extraDayCost, cost, minimumProfitable, priceBeforeDiscount, priceBasis, finalPrice, isProfitable, margin: finalPrice ? ((finalPrice - cost) / finalPrice) * 100 : 0, profit: finalPrice - cost, visits, complexity, confidence, needsReview, recommendation };
  }, [mode, membership, settings, manualAdjustment, property, sqm, bedrooms, bathrooms, condition, selectedAddons, urgent, weekend, frequency, flashDiscountPct, plannedDays]);

  const priceExplanation = result.priceBasis === "mínimo rentable"
    ? `El precio según alcance es ${money(result.tariff)}, pero no alcanza la rentabilidad objetivo. Por eso, el precio normal para el cliente se fijó en el mínimo rentable de ${money(result.priceBeforeDiscount)}.`
    : result.priceBasis === "precio mínimo configurado"
      ? `El precio normal para el cliente se fijó en el mínimo configurado de ${money(result.priceBeforeDiscount)}.`
      : `El precio según alcance de ${money(result.tariff)} supera el mínimo rentable de ${money(result.minimumProfitable)}, por lo que el trabajo es factible antes de aplicar promociones.`;
  const flashDiscountExplanation = flashDiscountPct === 0 ? "" : `El ${flashDiscountPct}% se aplicó directamente sobre el precio normal para el cliente de ${money(result.priceBeforeDiscount)}. Se descontaron ${money(result.flashDiscount)} y el nuevo precio final es ${money(result.finalPrice)}.`;

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const addAddon = () => {
    const addon: Addon = { id: `custom-${Date.now()}`, name: "Nuevo servicio adicional", price: 0, minutes: 30 };
    updateSetting("addons", [...settings.addons, addon]);
  };
  const removeAddon = (id: string) => {
    updateSetting("addons", settings.addons.filter((addon) => addon.id !== id));
    setSelectedAddons((current) => current.filter((selected) => selected !== id));
  };
  const openAddonSettings = () => {
    setActiveTab("settings");
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
    const addonNames = settings.addons.filter((item) => selectedAddons.includes(item.id)).map((item) => item.name);
    return `${heading}\nComuna: ${commune}\nPropiedad: ${PROPERTY_LABELS[property]}, ${sqm} m², ${bedrooms} dormitorio(s), ${bathrooms} baño(s)\nEstado: ${CONDITION_LABELS[condition]}\nFrecuencia: ${FREQUENCY[frequency].label}${addonNames.length ? `\nAdicionales: ${addonNames.join(", ")}` : ""}\nPlanificación por visita: ${result.daysPerVisit} jornada(s) de ${result.dailyHours.toFixed(1)} horas cada una\nTiempo total por visita: ${result.hoursPerVisit.toFixed(1)} horas${result.actualSavings > 0 ? `\nAhorro promocional aplicado: ${money(result.actualSavings)}` : ""}\nPrecio para el cliente: ${money(result.finalPrice)}\n${result.needsReview ? "Cotización preliminar: solicitar fotos y confirmar el alcance antes de agendar.\n" : ""}Incluye productos básicos. El cliente debe disponer de aspiradora en buen estado cuando se requiera. Valor sujeto a confirmación del estado real de la propiedad.`;
  }, [client, mode, membership, commune, result.finalPrice, result.hoursPerVisit, result.daysPerVisit, result.dailyHours, result.needsReview, result.actualSavings, settings.addons, selectedAddons, property, sqm, bedrooms, bathrooms, condition, frequency]);
  const copyQuote = async () => { await navigator.clipboard.writeText(quoteText); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const saveQuote = async () => {
    setQuoteSaveState("saving");
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client,
          commune,
          mode,
          summary: quoteText,
          finalPrice: result.finalPrice,
          normalPrice: result.priceBeforeDiscount,
          cost: result.cost,
          margin: result.margin,
          isProfitable: result.isProfitable,
        }),
      });
      if (!response.ok) throw new Error("save");
      const saved = await response.json();
      setSavedQuotes((current) => [{
        _id: saved.id,
        client,
        commune,
        mode,
        summary: quoteText,
        finalPrice: result.finalPrice,
        normalPrice: result.priceBeforeDiscount,
        cost: result.cost,
        margin: result.margin,
        isProfitable: result.isProfitable,
        createdAt: saved.createdAt,
      }, ...current].slice(0, 100));
      setQuoteSaveState("saved");
      window.setTimeout(() => setQuoteSaveState("idle"), 2000);
    } catch {
      setQuoteSaveState("error");
    }
  };
  const refreshQuotes = async () => {
    const response = await fetch("/api/quotes", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setSavedQuotes(Array.isArray(data.quotes) ? data.quotes : []);
  };

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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="workspace">
      <TabsList className="main-tabs">
        <TabsTrigger value="quote"><Calculator /> Cotizador</TabsTrigger>
        <TabsTrigger value="memberships"><WalletCards /> Membresías</TabsTrigger>
        <TabsTrigger value="history"><History /> Historial</TabsTrigger>
        <TabsTrigger value="settings"><Settings2 /> Configuraciones</TabsTrigger>
      </TabsList>

      <TabsContent value="quote" className="tab-panel">
        <section className="intro-row"><div><p className="eyebrow">Motor inteligente de cotización</p><h2>Precio, capacidad y rentabilidad en una sola vista.</h2><p>Calcula el valor, estima jornadas y detecta cuándo conviene pedir fotografías antes de confirmar.</p></div><div className={`save-chip ${syncState}`}><Cloud /> {syncState === "synced" ? "Configuración sincronizada" : syncState === "loading" ? "Guardando cambios…" : syncState === "error" ? "Sin conexión con la nube" : "Respaldo local activo"}</div></section>
        <div className="quote-grid">
          <section className="panel form-panel">
            <div className="mode-switch" role="group" aria-label="Tipo de cotización"><button className={mode === "service" ? "active" : ""} onClick={() => setMode("service")}>Servicio personalizado</button><button className={mode === "membership" ? "active" : ""} onClick={() => setMode("membership")}>Membresía</button></div>
            <div className="form-grid two">
              <label className="field"><span>Nombre del cliente</span><Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ej. Catalina Pérez" /></label>
              <label className="field"><span>Comuna</span><Select value={commune} onValueChange={setCommune}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Las Condes">Las Condes</SelectItem><SelectItem value="Providencia">Providencia</SelectItem></SelectContent></Select></label>
            </div>
            {mode === "membership" ? <div className="membership-picker">
              <label className="field"><span>Plan</span><Select value={membershipId} onValueChange={setMembershipId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{settings.memberships.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.line} · {plan.name}</SelectItem>)}</SelectContent></Select></label>
              <div className="selected-plan"><p>{membership.line}</p><h3>{membership.name}</h3><strong>{money(membership.price)} / mes</strong><ul>{membership.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul></div>
              <NumberField label="Ajuste manual final" value={manualAdjustment} onChange={setManualAdjustment} suffix="CLP" min={-1000000} step={1000} />
            </div> : <>
              <div className="section-label"><span>1</span> Propiedad</div>
              <div className="form-grid three">
                <label className="field"><span>Tipo</span><Select value={property} onValueChange={(value) => setProperty(value as PropertyKey)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PROPERTY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label>
                <NumberField label="Superficie" value={sqm} onChange={setSqm} suffix="m²" />
                <label className="field"><span>Estado</span><Select value={condition} onValueChange={(value) => setCondition(value as ConditionKey)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CONDITION_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label>
                <NumberField label="Dormitorios" value={bedrooms} onChange={setBedrooms} />
                <NumberField label="Baños" value={bathrooms} onChange={setBathrooms} />
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
              <div className="addon-grid">{settings.addons.map((addon) => { const checked = selectedAddons.includes(addon.id); return <label key={addon.id} className={`addon-card ${checked ? "selected" : ""}`}><Checkbox checked={checked} onCheckedChange={(value) => setSelectedAddons((current) => value ? [...current, addon.id] : current.filter((id) => id !== addon.id))} /><span>{addon.name}<strong>+ {money(addon.price)} <small>· {addon.minutes} min</small></strong></span></label>; })}</div>
              <div className="section-label"><span>4</span> Condiciones comerciales</div>
              <div className="option-row">
                <label><Checkbox checked={urgent} onCheckedChange={(value) => setUrgent(Boolean(value))} /><span>Servicio urgente<strong>+{settings.urgencyPct}%</strong></span></label>
                <label><Checkbox checked={weekend} onCheckedChange={(value) => setWeekend(Boolean(value))} /><span>Fin de semana o festivo<strong>+{settings.weekendPct}%</strong></span></label>
                <label className={`field flash-discount ${flashDiscountPct ? "active" : ""}`}><span><Zap /> Descuento relámpago</span><Select value={String(flashDiscountPct)} onValueChange={(value) => setFlashDiscountPct(Number(value) as FlashDiscountPct)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Sin descuento</SelectItem><SelectItem value="10">10% relámpago</SelectItem><SelectItem value="20">20% relámpago</SelectItem><SelectItem value="30">30% relámpago</SelectItem></SelectContent></Select></label>
                <NumberField label="Ajuste manual" value={manualAdjustment} onChange={setManualAdjustment} suffix="CLP" min={-1000000} step={1000} />
              </div>
            </>}
          </section>
          <aside className="result-panel">
            <p className="eyebrow">Resultado recomendado</p>
            <div className="final-price"><span>Precio para informar al cliente</span><strong>{money(result.finalPrice)}</strong><small>{mode === "membership" ? "valor mensual" : result.visits > 1 ? `valor total por ${result.visits} visitas` : "valor por servicio"}</small>{result.actualSavings > 0 ? <small className="promo-saving">Antes <s>{money(result.finalPrice + result.actualSavings)}</s> · ahorro {money(result.actualSavings)}</small> : null}<em><Check /> Este es el único precio que se envía al cliente</em></div>
            <div className="price-explanation"><strong>Evaluación del trabajo</strong><p>{priceExplanation}</p></div>
            {flashDiscountPct > 0 ? <div className={`flash-note ${result.isProfitable ? "applied" : "limited"}`}><Zap /><span><strong>Descuento relámpago aplicado al precio final</strong>{flashDiscountExplanation} {!result.isProfitable ? `Advertencia: después del descuento, el precio queda ${money(result.minimumProfitable - result.finalPrice)} bajo el mínimo rentable.` : "El servicio continúa siendo rentable después del descuento."}</span></div> : null}
            <div className="metrics"><div><Clock3 /><span>Horas totales<strong>{result.hours.toFixed(1)} h</strong></span></div><div><WalletCards /><span>Costo estimado<strong>{money(result.cost)}</strong></span></div><div className={!result.isProfitable ? "metric-risk" : ""}><ShieldCheck /><span>Margen final<strong>{result.margin.toFixed(1)}%</strong></span></div><div className={!result.isProfitable ? "metric-risk" : ""}><TrendingUp /><span>Utilidad final<strong>{money(result.profit)}</strong></span></div></div>
            <div className={`intelligence-card ${result.needsReview ? "review" : "ready"}`}>
              <div className="intelligence-title"><BrainCircuit /><strong>Análisis operativo</strong></div>
              <div className="intelligence-grid"><span>Complejidad<strong>{result.complexity}</strong></span><span>Confianza<strong>{result.confidence}</strong></span><span>Jornadas / visita<strong>{result.daysPerVisit}</strong></span><span>Horas / día<strong>{result.dailyHours.toFixed(1)} h</strong></span></div>
              <p>{result.recommendation}</p>
            </div>
            <details className="breakdown-details">
              <summary><span>Ver cálculo interno detallado</span><small>No se envía al cliente</small></summary>
              <div className="breakdown">
              <div><span>Tarifa base / plan</span><strong>{money(result.base)}</strong></div>
              {mode === "service" ? <><div><span>Tamaño adicional</span><strong>{money(result.sizeExtra)}</strong></div><div><span>Dormitorios y baños</span><strong>{money(result.roomExtra)}</strong></div><div><span>Estado de la propiedad</span><strong>{money(result.conditionExtra)}</strong></div><div><span>Servicios adicionales</span><strong>{money(result.addons)}</strong></div><div><span>Urgencia / fin de semana</span><strong>{money(result.urgency + result.weekend)}</strong></div><div className="discount"><span>Descuento por frecuencia</span><strong>− {money(result.discount)}</strong></div></> : null}
              <div><span>Ajuste manual</span><strong>{money(manualAdjustment)}</strong></div>
              <div className={`subtotal ${result.tariff >= result.minimumProfitable ? "viable" : "not-viable"}`}><span>Precio según alcance <small>Referencia interna · {result.tariff >= result.minimumProfitable ? "TRABAJO RENTABLE" : "TRABAJO NO RENTABLE"}</small></span><strong>{money(result.tariff)}</strong></div>
              {mode === "service" && result.extraDayCost > 0 ? <div className="operational"><span>Costo por jornadas adicionales <small>Traslado e insumos incluidos en el costo estimado</small></span><strong>{money(result.extraDayCost)}</strong></div> : null}
              <div className="floor"><span>Mínimo rentable <small>Control interno</small></span><strong>{money(result.minimumProfitable)}</strong></div>
              <div className="chosen"><span>Precio normal para el cliente <small>Antes del descuento relámpago · basado en {result.priceBasis}</small></span><strong>{money(result.priceBeforeDiscount)}</strong></div>
              <div className="discount flash"><span>Descuento relámpago <small>{flashDiscountPct}% sobre el precio normal</small></span><strong>− {money(result.flashDiscount)}</strong></div>
              <div className="client-total"><span>Precio para el cliente</span><strong>{money(result.finalPrice)}</strong></div>
              </div>
            </details>
            {result.needsReview ? <div className="warning"><CircleAlert /><span>Este servicio requiere validación previa. El precio debe confirmarse después de revisar fotos, alcance y accesibilidad.</span></div> : null}
            {!result.isProfitable ? <div className="warning profitability"><ShieldCheck /><span>Con el descuento seleccionado, el precio final no alcanza el margen objetivo. Puedes mantenerlo como decisión comercial, pero el trabajo queda bajo la rentabilidad configurada.</span></div> : <div className="success"><Check /><span>El precio final cubre el costo y el margen configurado.</span></div>}
            <div className="result-actions">
              <Button className="save-quote-button" onClick={saveQuote} disabled={quoteSaveState === "saving"}>{quoteSaveState === "saved" ? <Check /> : <Save />}{quoteSaveState === "saving" ? "Guardando…" : quoteSaveState === "saved" ? "Cotización guardada" : quoteSaveState === "error" ? "Reintentar guardado" : "Guardar cotización"}</Button>
              <Button className="copy-button" onClick={copyQuote}>{copied ? <Check /> : <Copy />}{copied ? "Cotización copiada" : "Copiar resumen para WhatsApp"}</Button>
            </div>
            <p className="fine-print">Valor sujeto a confirmación visual del estado real. Productos básicos incluidos. El cliente aporta aspiradora en buen estado cuando sea necesaria.</p>
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
            <Button variant="outline" onClick={() => { setMembershipId(plan.id); setMode("membership"); document.querySelector<HTMLButtonElement>('[data-slot="tabs-trigger"][value="quote"]')?.click(); }}>Usar en cotización</Button>
          </article>)}</div>
        </section>)}</div>
        <div className="policy-note"><ShieldCheck /><div><strong>Condiciones reales configuradas</strong><p>Cobertura actual: Las Condes y Providencia. Se incluyen productos básicos de limpieza. Cuando se necesite aspirado, el cliente debe disponer de una aspiradora en buen estado. Los servicios de alimentación, cuidado de mascotas y cobros automáticos deben activarse solo cuando Casa Limpia tenga la capacidad operativa necesaria.</p></div></div>
      </TabsContent>

      <TabsContent value="history" className="tab-panel">
        <section className="intro-row">
          <div><p className="eyebrow">Registro comercial</p><h2>Historial de cotizaciones</h2><p>Consulta las últimas 100 cotizaciones guardadas por esta cuenta.</p></div>
          <Button variant="outline" onClick={refreshQuotes}><History /> Actualizar historial</Button>
        </section>
        {savedQuotes.length ? <div className="quote-history">
          {savedQuotes.map((quote) => <article className="quote-history-card" key={quote._id}>
            <div className="quote-history-head"><div><span>{quote.mode === "membership" ? "Membresía" : "Servicio"}</span><h3>{quote.client || "Cliente sin nombre"}</h3><p>{quote.commune} · {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(quote.createdAt))}</p></div><strong>{money(quote.finalPrice)}</strong></div>
            <div className="quote-history-metrics"><span>Precio normal <strong>{money(quote.normalPrice)}</strong></span><span>Costo <strong>{money(quote.cost)}</strong></span><span>Margen <strong>{quote.margin.toFixed(1)}%</strong></span><span className={quote.isProfitable ? "profitable" : "risk"}>{quote.isProfitable ? "Rentable" : "Bajo margen"}</span></div>
            <details><summary>Ver resumen entregable</summary><pre>{quote.summary}</pre></details>
          </article>)}
        </div> : <div className="empty-history"><History /><h3>Aún no hay cotizaciones guardadas</h3><p>Genera una cotización y presiona “Guardar cotización”.</p></div>}
      </TabsContent>

      <TabsContent value="settings" className="tab-panel">
        <section className="intro-row"><div><p className="eyebrow">Control total</p><h2>Configuración completa del cotizador</h2><p>Todos los números que alimentan el panel lateral se definen aquí y se actualizan inmediatamente.</p></div><Button variant="outline" onClick={() => { setSettings(DEFAULT_SETTINGS); setManualAdjustment(DEFAULT_SETTINGS.defaultManualAdjustment); localStorage.removeItem("casa-limpia-pricing-v1"); }}><RotateCcw /> Restablecer valores</Button></section>
        <Accordion type="multiple" value={openSettingsSections} onValueChange={setOpenSettingsSections} className="settings-accordion">
          <AccordionItem value="pricing" className="settings-card"><AccordionTrigger><span><strong>Tarifas base y tamaño</strong><small>Precios por propiedad, m² incluidos y recargos por tamaño</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            <NumberField label="Precio mínimo" value={settings.minimumPrice} onChange={(v) => updateSetting("minimumPrice", v)} suffix="CLP" step={1000} />
            {(Object.keys(PROPERTY_LABELS) as PropertyKey[]).map((key) => <NumberField key={key} label={`Base ${PROPERTY_LABELS[key]}`} value={settings.propertyBase[key]} onChange={(v) => updateSetting("propertyBase", { ...settings.propertyBase, [key]: v })} suffix="CLP" step={1000} />)}
            {(Object.keys(PROPERTY_LABELS) as PropertyKey[]).map((key) => <NumberField key={`${key}-sqm`} label={`m² incluidos · ${PROPERTY_LABELS[key]}`} value={settings.includedSqm[key]} onChange={(v) => updateSetting("includedSqm", { ...settings.includedSqm, [key]: v })} suffix="m²" />)}
            <NumberField label="Cada m² adicional" value={settings.extraSqmPrice} onChange={(v) => updateSetting("extraSqmPrice", v)} suffix="CLP" step={50} /><NumberField label="Dormitorio adicional" value={settings.extraBedroomPrice} onChange={(v) => updateSetting("extraBedroomPrice", v)} suffix="CLP" step={1000} /><NumberField label="Baño adicional" value={settings.extraBathroomPrice} onChange={(v) => updateSetting("extraBathroomPrice", v)} suffix="CLP" step={1000} />
          </div></AccordionContent></AccordionItem>

          <AccordionItem value="rules" className="settings-card"><AccordionTrigger><span><strong>Estado, frecuencia y recargos</strong><small>Porcentajes comerciales aplicados automáticamente</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            {(Object.keys(CONDITION_LABELS) as ConditionKey[]).map((key) => <NumberField key={key} label={CONDITION_LABELS[key]} value={settings.conditionPct[key]} onChange={(v) => updateSetting("conditionPct", { ...settings.conditionPct, [key]: v })} suffix="%" />)}
            {(Object.keys(FREQUENCY) as FrequencyKey[]).map((key) => <NumberField key={key} label={`Descuento · ${FREQUENCY[key].label}`} value={settings.frequencyDiscountPct[key]} onChange={(v) => updateSetting("frequencyDiscountPct", { ...settings.frequencyDiscountPct, [key]: v })} suffix="%" />)}
            <NumberField label="Recargo urgente" value={settings.urgencyPct} onChange={(v) => updateSetting("urgencyPct", v)} suffix="%" /><NumberField label="Recargo fin de semana" value={settings.weekendPct} onChange={(v) => updateSetting("weekendPct", v)} suffix="%" />
          </div></AccordionContent></AccordionItem>

          <AccordionItem value="capacity" className="settings-card"><AccordionTrigger><span><strong>Capacidad y tiempo del equipo</strong><small>Horas reales, productividad y límite diario antes de dividir el servicio</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            <NumberField label="Personas por equipo" value={settings.workers} onChange={(v) => updateSetting("workers", v)} /><NumberField label="Rendimiento del equipo" value={settings.productivitySqmPerTeamHour} onChange={(v) => updateSetting("productivitySqmPerTeamHour", v)} suffix="m²/h" /><NumberField label="Horas mínimas por visita" value={settings.minimumVisitHours} onChange={(v) => updateSetting("minimumVisitHours", v)} suffix="h" step={0.5} /><NumberField label="Máximo de horas por jornada" value={settings.maxTeamHoursPerDay} onChange={(v) => updateSetting("maxTeamHoursPerDay", v)} suffix="h" step={0.5} min={1} />
            <NumberField label="Horas por dormitorio adicional" value={settings.extraBedroomHours} onChange={(v) => updateSetting("extraBedroomHours", v)} suffix="h" step={0.25} /><NumberField label="Horas por baño adicional" value={settings.extraBathroomHours} onChange={(v) => updateSetting("extraBathroomHours", v)} suffix="h" step={0.25} />
            {(Object.keys(CONDITION_LABELS) as ConditionKey[]).map((key) => <NumberField key={`hours-${key}`} label={`Horas extra · ${CONDITION_LABELS[key]}`} value={settings.conditionExtraHours[key]} onChange={(v) => updateSetting("conditionExtraHours", { ...settings.conditionExtraHours, [key]: v })} suffix="h" step={0.25} />)}
          </div></AccordionContent></AccordionItem>

          <AccordionItem value="costs" className="settings-card"><AccordionTrigger><span><strong>Costos y margen</strong><small>Evaluación de rentabilidad y precio normal recomendado</small></span></AccordionTrigger><AccordionContent><div className="form-grid four">
            <NumberField label="Costo por persona/hora" value={settings.workerHourlyCost} onChange={(v) => updateSetting("workerHourlyCost", v)} suffix="CLP" step={500} /><NumberField label="Costo base de insumos" value={settings.suppliesBaseCost} onChange={(v) => updateSetting("suppliesBaseCost", v)} suffix="CLP" step={500} /><NumberField label="Insumos por m²" value={settings.suppliesCostPerSqm} onChange={(v) => updateSetting("suppliesCostPerSqm", v)} suffix="CLP" step={5} /><NumberField label="Traslado por jornada" value={settings.transportCost} onChange={(v) => updateSetting("transportCost", v)} suffix="CLP" step={500} /><NumberField label="Margen objetivo" value={settings.targetMarginPct} onChange={(v) => updateSetting("targetMarginPct", v)} suffix="%" /><NumberField label="Ajuste manual predeterminado" value={settings.defaultManualAdjustment} onChange={(v) => { updateSetting("defaultManualAdjustment", v); setManualAdjustment(v); }} suffix="CLP" step={1000} min={-1000000} />
          </div></AccordionContent></AccordionItem>

          <AccordionItem value="addons" className="settings-card" id="additional-services-settings"><AccordionTrigger><span><strong>Servicios adicionales</strong><small>Nombre, precio y minutos que cada servicio suma al cálculo</small></span></AccordionTrigger><AccordionContent>
            <div className="settings-section-head"><p>Los cambios se reflejan inmediatamente en el cotizador y en el análisis operativo.</p><Button onClick={addAddon}><Plus /> Agregar servicio</Button></div>
            <div className="addon-settings">{settings.addons.map((addon) => <article className="addon-config-card" key={addon.id}><label className="field"><span>Nombre</span><Input value={addon.name} onChange={(e) => updateSetting("addons", settings.addons.map((item) => item.id === addon.id ? { ...item, name: e.target.value } : item))} /></label><NumberField label="Valor" value={addon.price} onChange={(value) => updateSetting("addons", settings.addons.map((item) => item.id === addon.id ? { ...item, price: value } : item))} suffix="CLP" step={1000} /><NumberField label="Tiempo estimado" value={addon.minutes} onChange={(value) => updateSetting("addons", settings.addons.map((item) => item.id === addon.id ? { ...item, minutes: value } : item))} suffix="min" step={5} /><Button variant="outline" className="delete-addon" aria-label={`Eliminar ${addon.name}`} onClick={() => removeAddon(addon.id)}><Trash2 /> Eliminar</Button></article>)}</div>
            {settings.addons.length === 0 ? <div className="empty-addons"><p>No hay servicios adicionales configurados.</p><Button variant="outline" onClick={addAddon}><Plus /> Crear el primero</Button></div> : null}
          </AccordionContent></AccordionItem>

          <AccordionItem value="memberships" className="settings-card"><AccordionTrigger><span><strong>Membresías y suscripciones</strong><small>Precio, visitas, horas mensuales y características de cada plan</small></span></AccordionTrigger><AccordionContent><div className="membership-config-grid">{settings.memberships.map((plan) => <article className="membership-config-card" key={plan.id}><div className="membership-config-title"><span>{plan.line}</span><strong>{plan.name}</strong></div><div className="form-grid two"><label className="field"><span>Nombre del plan</span><Input value={plan.name} onChange={(e) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, name: e.target.value } : item))} /></label><NumberField label="Precio mensual" value={plan.price} onChange={(value) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, price: value } : item))} suffix="CLP" step={1000} /><NumberField label="Visitas mensuales" value={plan.visits} onChange={(value) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, visits: value } : item))} /><NumberField label="Horas mensuales" value={plan.hours} onChange={(value) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, hours: value } : item))} suffix="h" /></div><label className="field"><span>Características, una por línea</span><Textarea value={plan.features.join("\n")} onChange={(e) => updateSetting("memberships", settings.memberships.map((item) => item.id === plan.id ? { ...item, features: e.target.value.split("\n").filter((feature) => feature.trim()) } : item))} /></label></article>)}</div></AccordionContent></AccordionItem>
        </Accordion>
        <section className="formula-card"><Calculator /><div><h3>Motor de cálculo avanzado</h3><p><strong>Precio según alcance:</strong> base + tamaño + habitaciones + estado + adicionales + recargos − descuento por frecuencia.</p><p><strong>Capacidad:</strong> estima las horas totales y permite planificar 1 o 2 jornadas. Las horas se reparten entre los días y se incorporan los costos de cada jornada.</p><p><strong>Precio final:</strong> primero se determina el precio normal para el cliente; después, el descuento relámpago se aplica íntegramente sobre ese valor. Si el resultado deja de ser rentable, el sistema lo advierte sin modificar el descuento.</p></div></section>
      </TabsContent>
    </Tabs>
    </Show>
  </main>;
}
