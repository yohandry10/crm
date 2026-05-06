import { describe, expect, it } from "vitest"
import {
  assertMagicBytes,
  assertStoragePathWithinPrefix,
  getSafeFileExtension,
  sanitizeStoragePath,
} from "@/lib/upload-security"

describe("upload security helpers", () => {
  it("normalizes safe storage paths", () => {
    expect(sanitizeStoragePath("/logos/2026/main.png")).toBe("logos/2026/main.png")
    expect(sanitizeStoragePath("  logos//brand-assets  ")).toBe("logos/brand-assets")
    expect(sanitizeStoragePath("")).toBeNull()
  })

  it("rejects traversal and unsafe path segments", () => {
    expect(() => sanitizeStoragePath("../admin")).toThrow("Ruta de archivo inválida")
    expect(() => sanitizeStoragePath("logos/../../secret")).toThrow("Ruta de archivo inválida")
    expect(() => sanitizeStoragePath("logos/<script>.png")).toThrow("Ruta de archivo inválida")
    expect(() => sanitizeStoragePath("a/b/c/d/e/f")).toThrow("Ruta de archivo demasiado profunda")
  })

  it("enforces tenant/user storage prefixes", () => {
    expect(() => assertStoragePathWithinPrefix("tenant-1/logo.png", "tenant-1")).not.toThrow()
    expect(() => assertStoragePathWithinPrefix("tenant-10/logo.png", "tenant-1")).toThrow(
      "Archivo fuera del alcance permitido",
    )
  })

  it("uses the MIME type as source of truth for extensions", () => {
    expect(getSafeFileExtension("invoice.exe", "application/pdf")).toBe("pdf")
    expect(getSafeFileExtension("avatar.svg", "image/png")).toBe("png")
    expect(getSafeFileExtension("photo.jpeg", "image/jpeg")).toBe("jpeg")
  })

  it("validates file signatures before uploads", () => {
    expect(() => assertMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png")).not.toThrow()
    expect(() => assertMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf")).not.toThrow()
    expect(() => assertMagicBytes(new Uint8Array([0x3c, 0x73, 0x76, 0x67]), "image/png")).toThrow(
      "Contenido PNG inválido",
    )
  })
})
