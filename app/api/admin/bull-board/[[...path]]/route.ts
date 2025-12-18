/**
 * API Route: Bull Board
 *
 * Sirve el dashboard de Bull Board
 *
 * IMPORTANTE: Esta ruta debe estar protegida para solo administradores
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBullBoard } from '@/lib/queues/bull-board'

// Importar el adaptador específico para Next.js
// Nota: Bull Board no tiene adaptador nativo para Next.js App Router,
// así que servimos el HTML directamente

export async function GET(request: NextRequest) {
  try {
    const board = getBullBoard()

    // Obtener el path de la request
    const url = new URL(request.url)
    const path = url.pathname.replace('/api/admin/bull-board', '') || '/'

    // Bull Board genera HTML estático
    // Para Next.js App Router, necesitamos servir el HTML directamente
    const { setQueues, replaceQueues, addQueue, removeQueue, ...uiConfig } =
      board

    // HTML básico del dashboard
    // En producción, considera usar el adaptador oficial o una solución más robusta
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bull Board - CRM AI Peru</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .notice {
            padding: 20px;
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            margin: 20px;
        }
        .notice h2 {
            margin: 0 0 10px 0;
            color: #0369a1;
        }
        .notice p {
            margin: 5px 0;
            color: #075985;
        }
        .notice code {
            background: #e0f2fe;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="notice">
        <h2>🚧 Bull Board Dashboard</h2>
        <p>Para visualizar el dashboard completo de Bull Board, necesitas:</p>
        <ol>
            <li>Ejecutar el worker: <code>pnpm worker</code></li>
            <li>Tener Redis corriendo: <code>pnpm docker:up</code></li>
            <li>Ejecutar algunos workflows para ver jobs en la cola</li>
        </ol>
        <p><strong>Estado de colas:</strong></p>
        <ul>
            <li>✅ Workflow Queue configurada</li>
            <li>⏳ Email Queue (próximamente)</li>
            <li>⏳ Import Queue (próximamente)</li>
        </ul>
        <p><em>Nota: Bull Board UI completo se integrará en la siguiente actualización.</em></p>

        <div style="margin-top: 20px; padding: 15px; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
            <h3 style="margin: 0 0 10px 0;">Comandos útiles:</h3>
            <pre style="background: #f9fafb; padding: 10px; border-radius: 4px; overflow-x: auto;"><code>
# Ver estado de Redis
pnpm redis:cli
> KEYS *

# Limpiar todas las colas
> FLUSHDB

# Ver jobs en cola de workflows
> KEYS bull:workflows:*
            </code></pre>
        </div>
    </div>
</body>
</html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error: any) {
    console.error('Error serving Bull Board:', error)
    return NextResponse.json(
      { error: 'Error loading Bull Board', details: error.message },
      { status: 500 }
    )
  }
}
