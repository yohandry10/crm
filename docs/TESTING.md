# Testing

Actualizado: 2026-05-06.

## Comandos reales

```bash
pnpm typecheck
pnpm test -- --reporter=basic
pnpm lint
pnpm production:check
pnpm production:verify-db
pnpm test:e2e -- --reporter=line
pnpm build
pnpm test:coverage
```

`pnpm test` ejecuta Vitest una vez. Para desarrollo interactivo usar `pnpm test:watch`.

## Estado observado

Ultima ejecucion manual local registrada: 2026-05-06.

Resultado:

- Typecheck: OK.
- Unit/contracts: 208 passed, 4 skipped.
- Lint: OK, con aviso externo de `baseline-browser-mapping` desactualizado.
- Production preflight: 0 failures, 0 warnings.
- Production DB verify: 0 failures, 109 checks.
- Coverage gate: OK con thresholds minimos activos (`statements 5`, `branches 27`, `functions 13`, `lines 5`).
- E2E focal RBAC/admin local: 39 passed.
- E2E focal seguridad/RBAC/multi-tenant/provisionamiento y flujos diarios/API previo: 51 passed.
- Build: OK.
- Produccion Vercel: health remoto OK y E2E focal remoto 51 passed contra `https://crm-trivia1.vercel.app`.

## E2E actual

La suite E2E usa Playwright y storage states separados.

Archivos principales:

- `tests/e2e/global-setup.ts`: provisiona usuarios y sesiones.
- `tests/e2e/login.spec.ts`: login regular, bloqueo admin para usuario regular y acceso platform admin.
- `tests/e2e/auth-security.spec.ts`: redirect seguro de login, recuperacion generica, rate limit de fallos y cambio de contraseña.
- `tests/e2e/admin-smoke.spec.ts`: paginas y APIs platform admin.
- `tests/e2e/modules.spec.ts`: carga de superficies UI principales.
- `tests/e2e/api-smoke.spec.ts`: smoke GET autenticado de APIs principales.
- `tests/e2e/crm-flows.spec.ts`: flujo CRM core e interconexion de entidades.
- `tests/e2e/daily-user-journey.spec.ts`: actividad diaria como usuario real.
- `tests/e2e/daily-advanced-ui.spec.ts`: actividad avanzada por UI real en modulos interconectados.
- `tests/e2e/role-matrix.spec.ts`: permisos por rol de organizacion.
- `tests/e2e/role-mutation-guards.spec.ts`: intentos directos de mutacion por API con roles limitados y escalamiento horizontal por registros de otros usuarios.
- `tests/e2e/multi-tenant-isolation.spec.ts`: aislamiento entre tenants, headers de organizacion, referencias cruzadas y payment links.
- `tests/e2e/tenant-provisioning.spec.ts`: bloqueo de autoprovicionamiento de organizaciones y bootstrap sin creacion de tenant.

## Usuarios E2E

No guardar passwords en documentacion. Las credenciales se cargan por variables locales o las provisiona `global-setup.ts`.

`global-setup.ts` normaliza primero las cuentas E2E configuradas y luego genera storage states. Esto evita sesiones invalidas cuando el setup actualiza contrasenas o metadata.

Tambien marca el tour de bienvenida como visto en los storage states E2E para que los tests remotos validen el modulo objetivo sin quedar bloqueados por un modal transversal de primera visita.

Variables requeridas para ejecutar toda la suite:

```powershell
$env:TEST_USER_EMAIL="..."
$env:TEST_USER_PASSWORD="..."
$env:TEST_ADMIN_EMAIL="..."
$env:TEST_ADMIN_PASSWORD="..."
pnpm test:e2e
```

Usuarios de rol provisionados automaticamente:

- `e2e.owner.crm@example.com`
- `e2e.admin.crm@example.com`
- `e2e.manager.crm@example.com`
- `e2e.member.crm@example.com`
- `e2e.viewer.crm@example.com`

## Coverage gate

```bash
pnpm test:coverage -- --reporter=basic
```

Resultado observado:

- Unit/contracts: ultima corrida previa 207 passed, 4 skipped; despues de agregar `tests/unit/events.test.ts`, `pnpm test -- --reporter=basic` queda en 208 passed, 4 skipped.
- Statements: 5.05%.
- Branches: 27.1%.
- Functions: 13.44%.
- Lines: 5.05%.

`vitest.config.ts` exige un baseline minimo: statements 5, branches 27, functions 13, lines 5. Es una compuerta conservadora para que CI no baje la cobertura mientras se sube por modulo critico.

## Cobertura funcional probada

### Usuario regular

- Entra al dashboard sin bloqueo de trial.
- No ve enlaces ni superficies de Super Admin.
- Crea cuenta, contacto, lead, producto, tarea, ticket, formulario y webhook.
- Valida inventario via redireccion canonica a productos.

### Platform admin

- Entra a `/admin` sin bloqueo de trial.
- Renderiza paginas admin principales.
- APIs admin principales responden correctamente.

### Auth y seguridad de cuenta

- Login neutraliza redirects externos y entra solo a rutas internas.
- Fallos repetidos de login quedan rate-limited sin exponer si la cuenta existe.
- Recuperacion de contraseña usa API protegida por rate limit y respuesta generica.
- Cambio de contraseña desde perfil exige contraseña actual y rechaza contraseñas debiles.

### Roles de organizacion

Roles cubiertos:

- `owner`
- `admin`
- `manager`
- `member`
- `viewer`

La matriz valida:

- Lectura de dashboard, contacts, leads, products, tasks, tickets, analytics y reports builder.
- Sin leakage de Super Admin.
- Sin trial gate.
- Contexto de rol desde `/api/team`.
- Acceso sensible a settings/integrations/webhooks solo cuando corresponde.
- Invitacion de equipo solo para roles autorizados.
- Escritura o denegacion en contacts, opportunities, products, quotes, invoices, tickets, campaigns, workflows y calendar events.
- Escritura o denegacion en accounts y orders.
- Denegacion explicita de mutaciones no autorizadas en contacts, opportunities, invoices, products, tasks, tickets, workflows, payments, quotes y records ajenos cuando el rol no tiene `can_manage_all`.

## Cobertura DB/produccion

`pnpm production:verify-db` valida:

- `schema_migrations`.
- Migraciones criticas 094-112 desde RPC de readiness; `production:check` exige tambien la migracion 113 de cobertura RBAC.
- RLS habilitado en tablas sensibles.
- Funciones RPC requeridas.
- Alineacion codigo-BD: tablas y RPC usadas por `app/`, `lib/` y `scripts/` existen en Supabase objetivo.
- Bloqueo de creacion self-service de organizaciones.
- Contrato `user_settings` con RLS.
- Contratos de payment tokens, invoice items, sales orders y payment provider settings.
- Remocion de artefactos legacy de Stripe.
- Hardening de seguridad de BD mediante `verify_security_hardening()`:
  - sin privilegios peligrosos `TRUNCATE`, `REFERENCES`, `TRIGGER` para `anon`/`authenticated`;
  - sin ejecucion anon/public de RPC sensibles;
  - funciones `SECURITY DEFINER` con `search_path` definido.

Nota: las migraciones 105-113 son exigidas por `production:check`; fueron aplicadas en la base objetivo y registradas en `schema_migrations` durante la validacion del 2026-05-06.

## Validacion de seguridad del 2026-05-06

Se auditaron grants, RLS, policies, triggers y RPC `SECURITY DEFINER` en la base Supabase objetivo. El hardening se implemento en las migraciones 109-112.

Resultado posterior:

- `verify_security_hardening()`: PASS en grants peligrosos, RPC anon/public y `search_path`.
- `pnpm production:verify-db`: 0 failures, 109 checks.
- `pnpm test:e2e -- tests/e2e/role-matrix.spec.ts tests/e2e/role-mutation-guards.spec.ts tests/e2e/admin-authorization.spec.ts --reporter=line`: 39 passed.
- E2E focal de regresion de seguridad/RBAC/multi-tenant/provisionamiento y flujos diarios/API: 51 passed.
- E2E focal remoto de produccion Vercel: 51 passed.
- Navegador local: dashboard carga en `http://localhost:3000/dashboard`, sin trial gate y sin errores de consola.

## Huecos restantes

- Coverage global tiene compuerta minima activa; falta subir umbrales por modulo critico.
- Falta ejecutar la misma matriz en CI como compuerta automatica.
- Falta cobertura profunda de concurrencia para booking/pagos fuera de contratos/RPC.
- Falta prueba con credenciales reales de Culqi/PagoEfectivo.
- Workflows near-real-time requieren worker persistente si se ofrece esa promesa operativa.

## Pruebas manuales utiles

Rate limit:

```bash
node scripts/manual/test-rate-limit.js
```

CORS:

```text
scripts/manual/test-cors.html
```
