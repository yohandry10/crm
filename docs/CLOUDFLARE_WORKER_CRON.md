# Cloudflare Worker (Cron) para procesar eventos + Workflows (BullMQ)

Objetivo: **sin servidor dedicado**, ejecutar crons desde Cloudflare que llaman a tu app en Vercel.

En este repo hay 2 “cosas” que conviene correr por cron:

- `/api/cron/process-events`: procesa `webhook_events` (eventos internos y triggers).
- `/api/cron/process-workflows`: drena la cola BullMQ `workflows` por tandas (serverless-friendly).

## Requisitos

- En Vercel (prod env):
  - `REDIS_URL` (Upstash `rediss://...`)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET` (protege `/api/cron/*` via `middleware.ts`)
- En Supabase (prod):
  - Migraciones aplicadas: `088`, `089`, `090`, `091`

## Endpoint en tu app

Este repo incluye:
- `app/api/cron/process-workflows/route.ts`
- `app/api/cron/process-events/route.ts`

Ejemplos:

- `GET https://TU_DOMINIO/api/cron/process-events`
- `GET https://TU_DOMINIO/api/cron/process-workflows?max_ms=20000&max_jobs=10&concurrency=2`

Headers aceptados (usa uno):

- `Authorization: Bearer <CRON_SECRET>` (recomendado, compatible con Supabase `pg_net`)
- `x-cron-secret: <CRON_SECRET>`

## Cloudflare Worker (Scheduler)

1. Cloudflare Dashboard:
  - Workers and Pages -> Create -> Worker
  - Settings -> Variables
    - `TARGET_URL` = `https://tu-app.vercel.app`
    - `CRON_SECRET` = el mismo de Vercel
2. Triggers -> Cron Triggers:
  - Ejemplo: `*/1 * * * *` (cada minuto)

### Código ejemplo (Worker)

```ts
export default {
  // 1) CRON (cada 1 min)
  async scheduled(_event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    const headers = {
      authorization: `Bearer ${env.CRON_SECRET}`,
      "x-cron-secret": env.CRON_SECRET, // opcional (compat)
    }

    const eventsUrl = new URL("/api/cron/process-events", env.TARGET_URL)

    const workflowsUrl = new URL("/api/cron/process-workflows", env.TARGET_URL)
    workflowsUrl.searchParams.set("max_ms", "20000")
    workflowsUrl.searchParams.set("max_jobs", "10")
    workflowsUrl.searchParams.set("concurrency", "2")

    const [eventsRes, workflowsRes] = await Promise.all([
      fetch(eventsUrl.toString(), { method: "GET", headers }),
      fetch(workflowsUrl.toString(), { method: "GET", headers }),
    ])

    // Opcional: log para debugging
    ctx.waitUntil(Promise.all([eventsRes.text().catch(() => null), workflowsRes.text().catch(() => null)]))
  },

  // 2) KICK HTTP (near real-time)
  // Tu app en Vercel puede llamar este endpoint cuando encola jobs/emite eventos.
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url)
    if (url.pathname !== "/kick") {
      return new Response("Not found", { status: 404 })
    }

    const auth = request.headers.get("authorization") || ""
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const headers = {
      authorization: `Bearer ${env.CRON_SECRET}`,
      "x-cron-secret": env.CRON_SECRET,
    }

    const eventsUrl = new URL("/api/cron/process-events", env.TARGET_URL)
    const workflowsUrl = new URL("/api/cron/process-workflows", env.TARGET_URL)
    workflowsUrl.searchParams.set("max_ms", "20000")
    workflowsUrl.searchParams.set("max_jobs", "10")
    workflowsUrl.searchParams.set("concurrency", "2")

    ctx.waitUntil(
      Promise.all([
        fetch(eventsUrl.toString(), { method: "GET", headers }).catch(() => null),
        fetch(workflowsUrl.toString(), { method: "GET", headers }).catch(() => null),
      ])
    )

    return new Response(null, { status: 204 })
  },
}
```

## Vercel: activar el kick (opcional pero recomendado)

En Vercel agrega:

- `CF_WORKER_KICK_URL` = `https://tu-worker.workers.dev/kick`
- (opcional) `CF_WORKER_KICK_SECRET` = si no lo defines, el código usa `CRON_SECRET`.

## Notas de operación

- Esto no es un “worker” persistente. Es un **drainer** por tiempo/cantidad.
- Ajusta frecuencia y `max_ms/max_jobs` según tráfico.
- Si tienes muchísimos workflows, sube la frecuencia (ej: cada 1 min) y/o `max_jobs`.
