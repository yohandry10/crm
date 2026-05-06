import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

function readProjectFile(filePath: string) {
  return readFileSync(path.join(root, filePath), "utf8")
}

describe("visual completeness guardrails", () => {
  it("does not expose non-persisted platform credential inputs", () => {
    const source = readProjectFile("app/admin/settings/page.tsx")

    expect(source).not.toContain('placeholder="pk_live_..."')
    expect(source).not.toContain('placeholder="sk_live_..."')
    expect(source).not.toContain('placeholder="pe_live_..."')
    expect(source).not.toContain('placeholder="re_..."')
    expect(source).toContain("Credenciales gestionadas por entorno")
  })

  it("keeps organization settings save detection aligned with editable sections", () => {
    const source = readProjectFile("app/settings/page.tsx")

    for (const field of [
      "logo_url",
      "yape_phone",
      "yape_qr_url",
      "plin_phone",
      "plin_qr_url",
      "bank_name",
      "bank_account",
      "bank_cci",
      "bank_holder",
      "notify_new_lead",
      "notify_task_due",
      "notify_payment_received",
      "notify_invoice_overdue",
    ]) {
      expect(source).toContain(`"${field}"`)
    }

    expect(source).toContain("Guardar Medios de Pago")
    expect(source).toContain("Guardar Notificaciones")
  })

  it("avoids native alerts and empty Radix select items in CRM modules", () => {
    const files = [
      "components/workflows/workflow-dialog.tsx",
      "components/workflows/nodes/action-node.tsx",
      "app/workflows/[id]/builder/page.tsx",
    ]

    for (const file of files) {
      const source = readProjectFile(file)
      expect(source).not.toContain("window.alert")
      expect(source).not.toContain('<SelectItem value="">')
    }
  })
})
