"use client"

export default function Page() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl space-y-3 text-center">
        <h1 className="text-xl font-semibold">Sentry no está configurado</h1>
        <p className="text-sm text-muted-foreground">
          Esta página de ejemplo venía de un template. Si quieres habilitar Sentry, instala
          `@sentry/nextjs` y configura la instrumentación correspondiente.
        </p>
      </div>
    </main>
  )
}
