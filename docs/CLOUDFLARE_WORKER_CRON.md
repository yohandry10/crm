# Cloudflare Worker Cron

Usar este enfoque solo si no hay Vercel Cron ni worker persistente para disparar tareas periodicas.

Estado actual: `vercel.json` ya define los cron jobs minimos. Cloudflare Worker queda como alternativa operacional.

## Endpoint

Los endpoints cron viven bajo:

```text
/api/cron/*
```

Requieren `CRON_SECRET`.

Headers aceptados por middleware:

```http
Authorization: Bearer <CRON_SECRET>
x-cron-secret: <CRON_SECRET>
```

Los handlers usan `lib/cron-auth.ts`, que acepta `Authorization: Bearer <CRON_SECRET>` y `x-cron-secret`.

## Worker ejemplo

```js
export default {
  async scheduled(event, env, ctx) {
    const endpoints = [
      "/api/cron/process-events",
      "/api/cron/process-workflows",
      "/api/cron/expire-quotes",
      "/api/cron/cleanup-cache"
    ]

    await Promise.all(endpoints.map((path) =>
      fetch(`${env.APP_URL}${path}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json"
        },
        body: "{}"
      })
    ))
  }
}
```

## Variables

```env
APP_URL=https://your-app.example.com
CRON_SECRET=same-secret-as-app
```

## Recomendaciones

- Registrar resultado de cada ejecucion.
- Alertar si falla dos veces seguidas.
- Evitar ejecutar drains largos dentro de requests serverless sin limites.
- Preferir worker persistente para BullMQ si workflows son parte del producto vendido.
