import { describe, expect, it } from "vitest"
import { formatDateOnlyInTimezone, getLastNDaysRangeInTimezone, getMonthRangeInTimezone, getRangeStartInTimezone } from "@/lib/date-utils"

describe("date-utils timezone helpers", () => {
  it("formatDateOnlyInTimezone formats YYYY-MM-DD in org timezone", () => {
    const date = new Date("2025-01-01T00:30:00.000Z")
    expect(formatDateOnlyInTimezone(date, "America/Lima")).toBe("2024-12-31")
    expect(formatDateOnlyInTimezone(date, "UTC")).toBe("2025-01-01")
  })

  it("getMonthRangeInTimezone returns boundaries that map to that month in the timezone", () => {
    const now = new Date("2025-03-15T12:00:00.000Z")
    const tz = "America/Lima"
    const range = getMonthRangeInTimezone(tz, now, 0)

    expect(range.startDate).toBe("2025-03-01")
    expect(range.endDate).toBe("2025-03-31")
    expect(formatDateOnlyInTimezone(range.startUtc, tz)).toBe("2025-03-01")
    expect(formatDateOnlyInTimezone(range.endUtc, tz)).toBe("2025-03-31")
  })

  it("getLastNDaysRangeInTimezone returns date-only bounds in timezone", () => {
    const now = new Date("2025-05-10T18:00:00.000Z")
    const tz = "America/Lima"
    const range = getLastNDaysRangeInTimezone(tz, now, 7)

    expect(range.endDate).toBe("2025-05-10")
    expect(range.startDate).toBe("2025-05-03")
  })

  it("getRangeStartInTimezone computes start for week/month/quarter/year", () => {
    const now = new Date("2025-05-10T18:00:00.000Z")
    const tz = "America/Lima"

    expect(getRangeStartInTimezone(tz, now, "week").startDate).toBe("2025-05-03")
    expect(getRangeStartInTimezone(tz, now, "month").startDate).toBe("2025-04-10")
    expect(getRangeStartInTimezone(tz, now, "quarter").startDate).toBe("2025-02-10")
    expect(getRangeStartInTimezone(tz, now, "year").startDate).toBe("2024-05-10")
  })
})

