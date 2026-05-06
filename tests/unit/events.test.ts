import { afterEach, describe, expect, it, vi } from "vitest"

const insert = vi.fn()
const from = vi.fn(() => ({ insert }))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from })),
}))

vi.mock("@/lib/realtime-kick", () => ({
  kickBackgroundProcessing: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

describe("emitEvent", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("persists organization_id as a top-level column for RLS", async () => {
    const { emitEvent } = await import("@/lib/events")
    const supabase = { from }

    insert.mockResolvedValueOnce({ error: null })

    await emitEvent(
      {
        event_type: "contact.created",
        source: "unit-test",
        payload: {
          id: "contact-1",
          organization_id: "org-1",
        },
      },
      supabase
    )

    expect(from).toHaveBeenCalledWith("webhook_events")
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        event_type: "contact.created",
        processed: false,
      })
    )
  })
})
