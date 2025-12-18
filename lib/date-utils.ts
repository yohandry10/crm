import type { SupabaseClient } from "@supabase/supabase-js"

type ZonedParts = {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number
  minute: number
  second: number
}

const DEFAULT_TIMEZONE = "America/Lima"

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function dateOnlyFromParts(parts: Pick<ZonedParts, "year" | "month" | "day">) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone)
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUTC - date.getTime()
}

function zonedPartsToUtcDate(parts: ZonedParts, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  return new Date(utcGuess.getTime() - offset)
}

function addMonthsToYearMonth(year: number, month: number, deltaMonths: number) {
  const m0 = (month - 1) + deltaMonths
  const year2 = year + Math.floor(m0 / 12)
  const month2 = ((m0 % 12) + 12) % 12
  return { year: year2, month: month2 + 1 }
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function shiftDatePartsByDays(year: number, month: number, day: number, deltaDays: number) {
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + deltaDays)
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  }
}

export async function getOrganizationTimezone(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  try {
    const { data } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organizationId)
      .single()

    const tz = data?.timezone || DEFAULT_TIMEZONE
    if (!tz || typeof tz !== "string") return DEFAULT_TIMEZONE
    return tz
  } catch {
    return DEFAULT_TIMEZONE
  }
}

export function formatDateOnlyInTimezone(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone)
  return dateOnlyFromParts(parts)
}

export function getMonthRangeInTimezone(
  timeZone: string,
  now: Date,
  offsetMonths: number = 0
): { startUtc: Date; endUtc: Date; startDate: string; endDate: string } {
  const zonedNow = getZonedParts(now, timeZone)
  const { year, month } = addMonthsToYearMonth(zonedNow.year, zonedNow.month, offsetMonths)
  const lastDay = daysInMonth(year, month)

  const startParts: ZonedParts = { year, month, day: 1, hour: 0, minute: 0, second: 0 }
  const endParts: ZonedParts = { year, month, day: lastDay, hour: 23, minute: 59, second: 59 }

  return {
    startUtc: zonedPartsToUtcDate(startParts, timeZone),
    endUtc: zonedPartsToUtcDate(endParts, timeZone),
    startDate: dateOnlyFromParts(startParts),
    endDate: dateOnlyFromParts(endParts),
  }
}

export function getLastNDaysRangeInTimezone(
  timeZone: string,
  now: Date,
  days: number
): { startUtc: Date; endUtc: Date; startDate: string; endDate: string } {
  const zonedNow = getZonedParts(now, timeZone)
  const endParts: ZonedParts = {
    year: zonedNow.year,
    month: zonedNow.month,
    day: zonedNow.day,
    hour: 23,
    minute: 59,
    second: 59,
  }

  const startDayParts = shiftDatePartsByDays(zonedNow.year, zonedNow.month, zonedNow.day, -days)
  const startParts: ZonedParts = { ...startDayParts, hour: 0, minute: 0, second: 0 }

  return {
    startUtc: zonedPartsToUtcDate(startParts, timeZone),
    endUtc: zonedPartsToUtcDate(endParts, timeZone),
    startDate: dateOnlyFromParts(startParts),
    endDate: dateOnlyFromParts(endParts),
  }
}

export function getRangeStartInTimezone(
  timeZone: string,
  now: Date,
  range: "week" | "month" | "quarter" | "year"
): { startUtc: Date; startDate: string } {
  const zonedNow = getZonedParts(now, timeZone)

  if (range === "week") {
    const startDayParts = shiftDatePartsByDays(zonedNow.year, zonedNow.month, zonedNow.day, -7)
    const startParts: ZonedParts = { ...startDayParts, hour: 0, minute: 0, second: 0 }
    return { startUtc: zonedPartsToUtcDate(startParts, timeZone), startDate: dateOnlyFromParts(startParts) }
  }

  const deltaMonths = range === "month" ? -1 : range === "quarter" ? -3 : -12
  const { year: targetYear, month: targetMonth } = addMonthsToYearMonth(zonedNow.year, zonedNow.month, deltaMonths)
  const maxDay = daysInMonth(targetYear, targetMonth)
  const targetDay = Math.min(zonedNow.day, maxDay)
  const startParts: ZonedParts = { year: targetYear, month: targetMonth, day: targetDay, hour: 0, minute: 0, second: 0 }

  return { startUtc: zonedPartsToUtcDate(startParts, timeZone), startDate: dateOnlyFromParts(startParts) }
}

/**
 * Formatea una fecha para Perú (dd/mm/yyyy) en timezone America/Lima.
 * Acepta ISO string o Date; retorna "—" si la fecha es inválida.
 */
export function formatDatePE(input: string | Date | null | undefined): string {
  if (!input) return "—"
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
