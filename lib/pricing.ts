import type { QuoteInput } from "@/lib/quote-schema";
import type { PricingSettings } from "@/lib/settings-schema";
import { SCOPES, EXCLUSIONS } from "./commercial.ts";

const visitsByFrequency = { one: 1, four: 4, eight: 8, twelve: 12 } as const;

export function calculateQuote(input: QuoteInput, settings: PricingSettings) {
  const legacy = calculateLegacyQuote(input, settings);
  const commercial = settings.commercial;
  const financialsPending = !!commercial && !commercial.costsConfirmed;
  if (!commercial || input.mode === "membership") return { ...legacy, financialsPending, personHours: legacy.hours, assignedWorkers: 1, scope: "Alcance según plan contratado", packageName: "Plan", dailyCapacity: 2, targetTakeHome: commercial?.targetTakeHome ?? 0, takeHome: legacy.profit, effectiveHourlyPay: legacy.hours ? legacy.profit / legacy.hours : 0, isProfitable: !financialsPending && legacy.isProfitable, needsReview: financialsPending || legacy.needsReview };
  const service = input.serviceType ?? (input.condition === "deep" ? "deep" : "general");
  const workers = input.workers ?? (input.sqm <= 35 && input.bedrooms <= 1 && input.bathrooms <= 1 ? 1 : 2);
  const pack = input.property === "department" ? commercial.packages.find(p => input.sqm <= p.sqm && input.bedrooms <= p.bedrooms && input.bathrooms <= p.bathrooms) : undefined;
  const packagePrice = pack?.[service];
  const reviewSize = packagePrice == null;
  const base = packagePrice ?? (input.property === "department" ? commercial.packages[4][service] ?? commercial.packages[4].deep : settings.propertyBase[input.property]);
  const sizeExtra = pack ? 0 : Math.max(0, input.sqm - (input.property === "department" ? 120 : settings.includedSqm[input.property])) * settings.extraSqmPrice;
  const included = service === "delivery" ? ["cabinets", "balcony"] : [];
  const active = settings.addons.filter(a => a.id !== "move" && !included.includes(a.id) && input.selectedAddonIds.includes(a.id));
  const quantity = (id: string) => input.addonQuantities?.[id] ?? 1;
  const addons = active.reduce((sum,a) => sum + a.price * quantity(a.id), 0);
  const addonHours = active.reduce((sum,a) => sum + a.minutes / 60 * quantity(a.id), 0);
  const visits = visitsByFrequency[input.frequency];
  const subtotal = base + sizeExtra + addons;
  const urgency = input.urgent ? subtotal * settings.urgencyPct / 100 : 0;
  const weekend = input.weekend ? subtotal * settings.weekendPct / 100 : 0;
  const gross = (subtotal + urgency + weekend) * visits;
  const discount = gross * settings.frequencyDiscountPct[input.frequency] / 100;
  const tariff = gross - discount + input.manualAdjustment;
  // Productivity is calibrated to the configured reference team; work hours
  // remain constant when the number assigned to this visit changes.
  const personHoursPerVisit = Math.max(settings.minimumVisitHours, input.sqm / settings.productivitySqmPerTeamHour + Math.max(0,input.bedrooms-1)*settings.extraBedroomHours + Math.max(0,input.bathrooms-1)*settings.extraBathroomHours + (service === "general" ? 0 : settings.conditionExtraHours.deep) + (service === "delivery" ? 1 : 0) + (input.condition === "accumulated" ? settings.conditionExtraHours.accumulated : 0) + addonHours) * settings.workers;
  const hoursPerVisit = personHoursPerVisit / workers;
  const requiredDaysPerVisit = Math.max(1, Math.ceil(hoursPerVisit / settings.maxTeamHoursPerDay));
  const daysPerVisit = Math.max(requiredDaysPerVisit, input.plannedDays || 1);
  const dailyHours = hoursPerVisit / daysPerVisit;
  const expensesPerDay = settings.suppliesBaseCost + input.sqm * settings.suppliesCostPerSqm + settings.transportCost + commercial.parkingCost + commercial.otherCost;
  const expenses = expensesPerDay * daysPerVisit * visits;
  const personHours = personHoursPerVisit * visits;
  const cost = expenses + personHours * settings.workerHourlyCost;
  const minimumProfitable = Math.max(cost / (1-settings.targetMarginPct/100), expenses + commercial.targetTakeHome*visits);
  const priceBeforeDiscount = Math.max(tariff, settings.minimumPrice*visits);
  const flashDiscount = priceBeforeDiscount * input.flashDiscountPct / 100;
  const finalPrice = priceBeforeDiscount - flashDiscount;
  const takeHome = finalPrice - expenses;
  const needsReview = reviewSize || service === "delivery" || input.condition === "accumulated" || requiredDaysPerVisit > 1 || financialsPending;
  return { ...legacy, base, sizeExtra, roomExtra: 0, conditionExtra: 0, addons, urgency, weekend, discount, tariff, hours: hoursPerVisit*visits, hoursPerVisit, personHours, assignedWorkers: workers, dailyHours, requiredDaysPerVisit, daysPerVisit, scheduleOverridden: input.plannedDays > 0 && input.plannedDays < requiredDaysPerVisit, serviceDays: daysPerVisit*visits, extraDayCost: expensesPerDay*Math.max(0,daysPerVisit-1)*visits, cost, minimumProfitable, priceBeforeDiscount, priceBasis: "tarifa por tipología; rentabilidad por verificar", flashDiscount, actualSavings: flashDiscount, finalPrice, profit: finalPrice-cost, margin: finalPrice ? (finalPrice-cost)/finalPrice*100 : 0, isProfitable: !financialsPending && finalPrice >= minimumProfitable, financialsPending, takeHome, effectiveHourlyPay: personHours ? takeHome/personHours : 0, targetTakeHome: commercial.targetTakeHome*visits, visits, needsReview, confidence: "Provisional", packageName: pack?.name ?? "Fuera de tabla: evaluación previa", scope: SCOPES[service] + " " + EXCLUSIONS, dailyCapacity: Math.min(2, Math.floor(settings.maxTeamHoursPerDay / hoursPerVisit)), recommendation: "Tiempos estimados sin calibración real. Máximo dos propiedades al día, sujeto a traslados. " + (needsReview ? "Confirmar fotos, alcance y costos antes de agendar." : "Verificar disponibilidad y tiempos antes de agendar.") };
}

function calculateLegacyQuote(input: QuoteInput, settings: PricingSettings) {
  if (input.mode === "membership") {
    const membership = settings.memberships.find((plan) => plan.id === input.membershipId);
    if (!membership || membership.hours <= 0 || membership.visits <= 0) throw new Error("MEMBERSHIP_INCOMPLETE");
    const cost = membership.hours * settings.workerHourlyCost + membership.visits * (settings.suppliesBaseCost + settings.transportCost);
    const minimumProfitable = settings.targetMarginPct >= 100 ? cost : cost / (1 - settings.targetMarginPct / 100);
    const tariff = membership.price + input.manualAdjustment;
    const priceBeforeDiscount = Math.max(tariff, minimumProfitable, settings.minimumPrice);
    const priceBasis = minimumProfitable >= tariff && minimumProfitable >= settings.minimumPrice ? "mínimo rentable" : settings.minimumPrice >= tariff ? "precio mínimo configurado" : "precio del plan";
    const finalPrice = priceBeforeDiscount;
    const hoursPerVisit = membership.hours / membership.visits;
    return { base: membership.price, sizeExtra: 0, roomExtra: 0, conditionExtra: 0, addons: 0, urgency: 0, weekend: 0, discount: 0, flashDiscount: 0, actualSavings: 0, tariff, hours: membership.hours, hoursPerVisit, dailyHours: hoursPerVisit, daysPerVisit: 1, requiredDaysPerVisit: 1, scheduleOverridden: false, serviceDays: membership.visits, extraDayCost: 0, cost, minimumProfitable, priceBeforeDiscount, priceBasis, finalPrice, isProfitable: finalPrice >= minimumProfitable, margin: finalPrice ? ((finalPrice - cost) / finalPrice) * 100 : 0, profit: finalPrice - cost, visits: membership.visits, complexity: "Plan", confidence: "Alta", needsReview: false, recommendation: "Plan recurrente listo para presentar." };
  }

  const visits = visitsByFrequency[input.frequency];
  const base = settings.propertyBase[input.property];
  const sizeExtra = Math.max(0, input.sqm - settings.includedSqm[input.property]) * settings.extraSqmPrice;
  const roomExtra = Math.max(0, input.bedrooms - 1) * settings.extraBedroomPrice + Math.max(0, input.bathrooms - 1) * settings.extraBathroomPrice;
  const beforeCondition = base + sizeExtra + roomExtra;
  const conditionExtra = beforeCondition * settings.conditionPct[input.condition] / 100;
  const activeAddons = settings.addons.filter((addon) => input.selectedAddonIds.includes(addon.id));
  const addons = activeAddons.reduce((sum, addon) => sum + addon.price, 0);
  const addonHours = activeAddons.reduce((sum, addon) => sum + addon.minutes / 60, 0);
  const visitSubtotal = beforeCondition + conditionExtra + addons;
  const urgency = input.urgent ? visitSubtotal * settings.urgencyPct / 100 : 0;
  const weekend = input.weekend ? visitSubtotal * settings.weekendPct / 100 : 0;
  const gross = (visitSubtotal + urgency + weekend) * visits;
  const discount = gross * settings.frequencyDiscountPct[input.frequency] / 100;
  const tariff = gross - discount + input.manualAdjustment;
  const hoursPerVisit = Math.max(settings.minimumVisitHours, input.sqm / Math.max(1, settings.productivitySqmPerTeamHour) + Math.max(0, input.bedrooms - 1) * settings.extraBedroomHours + Math.max(0, input.bathrooms - 1) * settings.extraBathroomHours + settings.conditionExtraHours[input.condition] + addonHours);
  const requiredDaysPerVisit = Math.max(1, Math.ceil(hoursPerVisit / Math.max(1, settings.maxTeamHoursPerDay)));
  const daysPerVisit = input.plannedDays === 0 ? requiredDaysPerVisit : Math.max(requiredDaysPerVisit, input.plannedDays);
  const scheduleOverridden = input.plannedDays > 0 && input.plannedDays < requiredDaysPerVisit;
  const dailyHours = hoursPerVisit / daysPerVisit;
  const serviceDays = daysPerVisit * visits;
  const extraDayCost = (settings.suppliesBaseCost + input.sqm * settings.suppliesCostPerSqm + settings.transportCost) * Math.max(0, daysPerVisit - 1) * visits;
  const cost = (hoursPerVisit * settings.workers * settings.workerHourlyCost + (settings.suppliesBaseCost + input.sqm * settings.suppliesCostPerSqm) * daysPerVisit + settings.transportCost * daysPerVisit) * visits;
  const minimumProfitable = settings.targetMarginPct >= 100 ? cost : cost / (1 - settings.targetMarginPct / 100);
  const priceBeforeDiscount = Math.max(tariff, minimumProfitable, settings.minimumPrice);
  const priceBasis = minimumProfitable >= tariff && minimumProfitable >= settings.minimumPrice ? "mínimo rentable" : settings.minimumPrice >= tariff ? "precio mínimo configurado" : "precio según alcance";
  const flashDiscount = priceBeforeDiscount * input.flashDiscountPct / 100;
  const finalPrice = Math.max(0, priceBeforeDiscount - flashDiscount);
  const isProfitable = finalPrice >= minimumProfitable;
  const conditionWeight = { maintenance: 0, normal: 1, accumulated: 3, deep: 5 } as const;
  const complexityScore = conditionWeight[input.condition] + (input.sqm > 120 ? 3 : input.sqm > 80 ? 2 : input.sqm > 50 ? 1 : 0) + (input.bathrooms > 2 ? 1 : 0) + (activeAddons.length >= 3 ? 2 : activeAddons.length ? 1 : 0) + (input.urgent ? 1 : 0);
  const complexity = complexityScore >= 7 ? "Alta" : complexityScore >= 4 ? "Media" : "Baja";
  const needsReview = input.condition === "deep" || input.condition === "accumulated" || requiredDaysPerVisit > 1 || input.sqm > 150;
  const confidence = input.condition === "deep" || input.sqm > 180 ? "Baja" : needsReview ? "Media" : "Alta";
  const recommendation = daysPerVisit > 1 ? `Servicio planificado en ${daysPerVisit} jornadas de ${dailyHours.toFixed(1)} horas cada una.` : needsReview ? "Solicitar fotos antes de confirmar el valor." : "Cotización apta para confirmar con revisión final.";
  return { base, sizeExtra, roomExtra, conditionExtra, addons, urgency, weekend, discount, flashDiscount, actualSavings: flashDiscount, tariff, hours: hoursPerVisit * visits, hoursPerVisit, dailyHours, daysPerVisit, requiredDaysPerVisit, scheduleOverridden, serviceDays, extraDayCost, cost, minimumProfitable, priceBeforeDiscount, priceBasis, finalPrice, isProfitable, margin: finalPrice ? ((finalPrice - cost) / finalPrice) * 100 : 0, profit: finalPrice - cost, visits, complexity, confidence, needsReview, recommendation };
}
