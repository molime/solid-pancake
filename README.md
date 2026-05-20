# ATRIA-X MVP

ATRIA-X es una aplicación hecha con React, Vite, Clerk y Convex para agencias de cuidado.

El flujo principal es este:

1. Un cuidador completa la documentación de su turno.
2. Un coordinador revisa esa documentación.
3. Solo los turnos completos y aprobados quedan listos para facturación.

La regla del producto es sencilla: **no se factura un servicio si la documentación no está completa y validada**.

## Roles

### Administrador de agencia

Ve Dashboard, Review, Billing, Clients, Team y Knowledge.

Puede administrar la agencia, invitar personas al equipo, cambiar roles, manejar clientes, cargar datos demo, revisar casos como apoyo y crear facturas desde turnos aprobados.

### Coordinador

Ve Dashboard, Review, Billing, Clients y Knowledge.

Puede revisar turnos enviados, aprobar documentación, pedir correcciones, descargar pruebas y crear facturas.

### Cuidador

Ve Today y Knowledge.

Puede documentar sus turnos asignados, completar tareas, subir pruebas obligatorias y consultar documentos internos de la agencia.

### Administrador de plataforma

Ve Platform.

Es un rol interno de ATRIA-X para consultar agencias, miembros, clientes y turnos. No es lo mismo que administrador de agencia.

Los administradores de agencia no usan normalmente la vista **Today**. Esa vista es solo para cuidadores. El acceso de plataforma se controla en la tabla `platformAdmins` de Convex.

## Qué está construido

1. Login multiagencia con organizaciones de Clerk.
2. Flujo para crear o seleccionar una agencia y reflejarla como tenant en Convex.
3. Tablas de Convex separadas por `tenantId`.
4. Navegación por rol y validaciones de rol también en el backend.
5. Flujo de documentación para cuidadores con campos de hora, nota obligatoria, tareas y subida de pruebas.
6. Revisión de coordinador con descarga de pruebas, aprobación, solicitud de corrección e historial.
7. Facturación con líneas listas para facturar, filtros por cuidador y fechas, creación de facturas, descarga CSV y ledger completo.
8. Búsqueda de conocimiento con búsqueda vectorial, embeddings determinísticos de 32 dimensiones y creación de artículos para admins y coordinadores.
9. Visibilidad de documentos para todo el equipo o solo admins y coordinadores.
10. Invitaciones de equipo creadas desde el servidor para que el invitado regrese a ATRIA-X.
11. Página de plataforma en `/platform` para listar agencias.
12. Datos demo desde el dashboard, sin duplicar registros en clicks repetidos.

## Stack

1. React 19
2. Vite 8
3. TypeScript
4. Tailwind CSS 4
5. Clerk React
6. Convex
7. React Router
8. Vitest
9. Playwright

## Instalación local

Instala dependencias:

```bash
npm install
```

Crea las variables locales:

```bash
cp .env.example .env.local
```

`.env.local` necesita esto:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CONVEX_URL=https://tidy-crocodile-154.convex.cloud
```

En Convex también se necesitan estas variables:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://capable-macaw-17.clerk.accounts.dev
npx convex env set CLERK_SECRET_KEY sk_test_...
```

Arranca la app:

```bash
npm run dev
```

Abre la URL que imprime Vite. Normalmente es:

```text
http://localhost:5173
```

## Setup rápido para demo

1. Entra con Clerk o crea una cuenta.
2. Crea o selecciona una agencia.
3. Entra al dashboard de ATRIA-X.
4. Da click en **Seed demo data**.

El seed crea o repara clientes demo, turnos, notas, tareas, documentos de conocimiento, un turno enviado a revisión y una línea lista para facturar. Si le das click varias veces, no duplica datos. La app muestra si creó, omitió o reparó registros.

Para probar roles separados, invita una cuenta de cuidador y una de coordinador desde **Team**. Después usa **Clients > Schedule** o **Bulk schedule** para asignar turnos al cuidador.

Los turnos del pasado o del momento actual se pueden documentar de inmediato. Los turnos futuros se quedan programados hasta su hora de inicio.

## Scripts

Calidad de código:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Pruebas de navegador:

```bash
npm run e2e
```

Regenerar tipos de Convex después de cambiar funciones o schema:

```bash
npx convex codegen
```

## Estructura del proyecto

```text
src/app              Providers, router, shells, guards y selección de agencia
src/features         Funcionalidades separadas por flujo
src/shared           UI compartida, formato y utilidades pequeñas
convex               Schema, auth, queries, mutations y actions
tests/e2e            Pruebas smoke con Playwright
```

Carpetas principales:

```text
src/features/caregiver      Documentación de turnos
src/features/coordinator    Cola de revisión y decisiones
src/features/billing        Facturas, CSV y ledger
src/features/clients        Clientes y programación
src/features/team           Invitaciones y roles
src/features/search         Búsqueda y artículos de conocimiento
src/features/platform       Vista interna de plataforma
```

## Notas importantes

1. La app es multiagencia. Una organización de Clerk corresponde a un tenant de ATRIA-X.
2. Las tablas principales guardan `tenantId`.
3. Casi todas las rutas necesitan una organización activa de Clerk.
4. `/platform` solo necesita sesión iniciada y luego valida `platformAdmins`.
5. Los roles de agencia son `org:admin`, `org:coordinator` y `org:caregiver`.
6. Las pantallas por rol se protegen en React Router y se vuelven a validar en Convex.
7. Los admins de plataforma no son admins de agencia.
8. Las pruebas de turno usan Convex Storage y metadata en la tabla `files`.
9. Los documentos de Knowledge viven en `complianceDocs`.
10. Todavía no hay archivos adjuntos para documentos de Knowledge.
11. La tabla `exportBatches` se conserva por compatibilidad, pero en la UI esos registros se manejan como facturas.
12. Las pruebas E2E completas con sesión iniciada necesitan cuentas de prueba de Clerk. Las pruebas actuales cubren smoke checks sin sesión.
13. Convex usa el token de sesión normal de Clerk. Las claims de organización deben estar presentes y `CLERK_JWT_ISSUER_DOMAIN` debe coincidir con la instancia de Clerk.
14. Las invitaciones de Clerk se crean desde Convex para que el correo mande al invitado a `/accept-invitation` en ATRIA-X. Esto necesita `CLERK_SECRET_KEY` en las variables de Convex.
15. Los secretos se quedan en `.env.local` o en variables del proveedor. Solo `.env.example` se sube al repo.
