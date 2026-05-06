const COMMON_PASSWORDS = new Set([
  "12345678",
  "password",
  "qwerty123",
  "admin123",
  "password123",
  "123456789",
  "1234567890",
])

export function validateAuthPassword(password: string, label = "La contraseña") {
  if (password.length < 10) {
    return `${label} debe tener al menos 10 caracteres`
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return `${label} debe incluir mayúscula, minúscula y número`
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return `${label} es demasiado común. Elige una más segura`
  }

  return null
}

export function sanitizeAuthRedirect(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback

  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback
    if (decoded.includes("\\") || decoded.includes("\n") || decoded.includes("\r")) return fallback
    return decoded
  } catch {
    return fallback
  }
}
