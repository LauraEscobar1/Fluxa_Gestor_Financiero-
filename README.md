# Fluxa API

API REST de **gestión financiera personal**: cada usuario registra sus ingresos y gastos, los organiza por categorías, define presupuestos mensuales con seguimiento del gasto real, gestiona metas de ahorro con su historial y consulta su información de forma aislada de los demás usuarios.

## Contenido

- [Stack](#stack)
- [Arquitectura](#arquitectura)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Cómo levantar el proyecto](#cómo-levantar-el-proyecto)
- [Variables de entorno](#variables-de-entorno)
- [Scripts](#scripts)
- [Base de datos: migraciones y seed](#base-de-datos-migraciones-y-seed)
- [Pruebas](#pruebas)
- [Convenciones de la API](#convenciones-de-la-api)
- [Endpoints](#endpoints)
- [Seguridad](#seguridad)
- [Documentación OpenAPI y Postman](#documentación-openapi-y-postman)

## Stack

- [NestJS](https://nestjs.com/) 12 + TypeScript
- PostgreSQL 15 con [TypeORM](https://typeorm.io/)
- Validación con `class-validator` / `class-transformer`
- Autenticación JWT (`@nestjs/jwt`) y contraseñas con `bcrypt`
- Documentación con Swagger (`@nestjs/swagger`)
- Limitación de peticiones con `@nestjs/throttler` y cabeceras de seguridad con `helmet`
- Jest + Supertest (pruebas), oxlint (lint), Prettier (formato)
- Docker Compose (PostgreSQL + pgAdmin para desarrollo)

## Arquitectura

Cada petición atraviesa las mismas capas:

```
Cliente HTTP
   │  (helmet · CORS · logger · ThrottlerGuard · JwtAuthGuard · ValidationPipe)
   ▼
Controller   → rutas, validación del DTO, Swagger. Sin lógica de negocio.
   ▼
Service      → reglas de negocio; recibe el `userId` del token y filtra por él.
   ▼
TypeORM      → repositorios y QueryBuilder.
   ▼
PostgreSQL
```

- **Aislamiento por usuario:** todo recurso pertenece a un usuario (`userId`). Cada método de servicio recibe el `userId` del token y lo incluye en la consulta; un recurso ajeno es indistinguible de uno inexistente (**404**, nunca 403).
- **Guard global:** `JwtAuthGuard` protege todas las rutas salvo las marcadas con `@Public()` (registro, login y `/health`).
- **Filtro global de excepciones:** unifica el formato de errores y no filtra detalles internos en los 500.
- **Campos calculados:** `spent`/`status` de presupuestos, `status`/`progressPercent` de metas y todo `/summary` no se guardan; se calculan en cada respuesta.

## Estructura de carpetas

```
src/
├── main.ts                    # arranque: helmet, CORS, pipes, filtros, Swagger
├── app.module.ts              # Config, TypeORM, Throttler y módulos de dominio
├── auth/                      # registro, login, JWT, guard global, @Public(), @CurrentUser()
├── users/                     # perfil propio (GET/PATCH/DELETE /users/me)
├── categories/                # categorías (+ categorías por defecto al registrarse)
├── transactions/              # ingresos y gastos
├── budgets/                   # presupuestos mensuales con gasto calculado
├── savings-goals/             # metas de ahorro, depósitos, retiros e historial
├── financial-summary/         # resumen del dashboard (/summary): agregados por mes, categoría y año
├── health/                    # GET /health
├── common/                    # filtro de errores, paginación, fechas, password, config, swagger
├── database/
│   ├── data-source.ts         # DataSource del CLI de TypeORM
│   ├── migrations/            # migraciones (InitialSchema)
│   └── seeds/                 # seed de datos demo
└── docs/export-openapi.ts     # exporta docs/openapi.json
test/                          # pruebas e2e HTTP (servicios simulados)
docs/openapi.json              # documento OpenAPI para Postman
```

## Requisitos

- Node.js 24+ y npm
- Docker y Docker Compose

## Cómo levantar el proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de variables de entorno y cambiar JWT_SECRET
cp .env.example .env

# 3. Levantar PostgreSQL y pgAdmin
docker compose up -d

# 4. Iniciar la API en modo desarrollo
#    (con DB_SYNCHRONIZE=true en .env las tablas se crean solas)
npm run start:dev

# 5. (Opcional) Cargar datos de demostración
npm run seed
```

- API: <http://localhost:3000>
- Swagger: <http://localhost:3000/api>
- Salud: <http://localhost:3000/health>
- pgAdmin: <http://localhost:5050> (credenciales en `.env`; para conectarse a la base usa host `postgres`, puerto `5432`)

**Usuario demo** (tras `npm run seed`): `demo@fluxa.com` / `Demo1234`.

## Variables de entorno

Se definen en `.env` (ver `.env.example`).

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `NODE_ENV` | Entorno (`development` / `production`) | `development` |
| `PORT` | Puerto de la API | `3000` |
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL en el host | `5433` |
| `DB_USERNAME` | Usuario de la base de datos | `fluxa_user` |
| `DB_PASSWORD` | Contraseña de la base de datos | `fluxa_password` |
| `DB_NAME` | Nombre de la base de datos | `fluxa_db` |
| `DB_SYNCHRONIZE` | Sincroniza tablas con las entidades (**solo desarrollo**; con `NODE_ENV=production` la API se niega a arrancar si es `true`) | `true` |
| `DB_MIGRATIONS_RUN` | Ejecuta las migraciones pendientes al iniciar | `false` |
| `JWT_SECRET` | Secreto para firmar los tokens (**obligatorio**, la API no arranca sin él; usa uno largo y aleatorio) | — |
| `JWT_EXPIRES_IN` | Duración del token (`15m`, `1h`, `7d` o segundos) | `1h` |
| `CORS_ORIGIN` | Orígenes permitidos separados por comas. Sin definir: abierto en desarrollo y desactivado en producción | vacío |
| `THROTTLE_TTL_MS` | Ventana del límite de peticiones (ms) | `60000` |
| `THROTTLE_LIMIT` | Peticiones máximas por ventana y cliente | `100` |
| `PGADMIN_EMAIL` | Usuario de pgAdmin | `admin@fluxa.com` |
| `PGADMIN_PASSWORD` | Contraseña de pgAdmin | `admin123` |
| `PGADMIN_PORT` | Puerto de pgAdmin | `5050` |

## Scripts

| Script | Descripción |
|---|---|
| `npm run start:dev` | Inicia la API con recarga automática |
| `npm run build` | Compila el proyecto a `dist/` |
| `npm run start:prod` | Ejecuta la versión compilada |
| `npm run lint` | Analiza el código con oxlint |
| `npm run format` | Formatea el código con Prettier |
| `npm test` | Pruebas unitarias |
| `npm run test:e2e` | Pruebas end-to-end |
| `npm run test:cov` | Pruebas unitarias con cobertura |
| `npm run migration:generate -- src/database/migrations/Nombre` | Genera una migración a partir de las entidades |
| `npm run migration:run` | Ejecuta las migraciones pendientes |
| `npm run migration:revert` | Revierte la última migración |
| `npm run seed` | Carga los datos de demostración (idempotente; no corre en producción) |
| `npm run docs:openapi` | Compila y exporta `docs/openapi.json` |

## Base de datos: migraciones y seed

### Migraciones

El esquema completo está en `src/database/migrations/` (migración `InitialSchema`): tablas, enums (`category_type`, `savings_goal_movement_type`), únicos, índices (`user_id, date` en transacciones) y claves foráneas con su `onDelete`.

- **Desarrollo:** `DB_SYNCHRONIZE=true` crea las tablas solas.
- **Producción (o cualquier base nueva con migraciones):**

```bash
# .env: DB_SYNCHRONIZE=false  (y NODE_ENV=production si corresponde)
npm run migration:run      # crea el esquema
npm run start:prod         # o DB_MIGRATIONS_RUN=true para migrar al arrancar
```

- Para volver atrás: `npm run migration:revert`.
- Si cambias una entidad, genera una migración nueva con `migration:generate`. Revisa el SQL: si dos entidades comparten un enum, TypeORM puede crearlo dos veces (pasó con `category_type` y se corrigió a mano en `InitialSchema`).
- Para empezar de cero en desarrollo: `docker compose down -v && docker compose up -d`.

### Seed de datos demo

`npm run seed` crea (en una sola transacción) el usuario `demo@fluxa.com` / `Demo1234`, sus categorías por defecto, 40 transacciones de los últimos 3 meses, 3 presupuestos del mes actual (uno en `warning`, uno `exceeded` y uno `ok`) y 2 metas de ahorro con movimientos. Es idempotente (si el usuario existe no hace nada) y se niega a correr con `NODE_ENV=production`. Requiere que las tablas ya existan.

## Pruebas

```bash
npm test          # unitarias de servicios y utilidades (sin base de datos)
npm run test:e2e  # e2e HTTP: controladores reales, servicios simulados, ValidationPipe y guard JWT reales
npm run test:cov  # unitarias con cobertura (carpeta coverage/)
```

Los scripts de Jest usan `--experimental-vm-modules` porque los paquetes de Nest 12 se publican como módulos ESM; no los llames con `npx jest` directamente.

## Convenciones de la API

### Autenticación

Regístrate o inicia sesión para obtener un `accessToken` y envíalo en cada petición:

```http
Authorization: Bearer <accessToken>
```

Sin token, con un token inválido/expirado o de una cuenta eliminada, la API responde **401**. Solo son públicas `POST /auth/register`, `POST /auth/login` y `GET /health`.

### Formato de errores

Todos los errores tienen la misma forma:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": ["El mes debe estar entre 1 y 12"],
  "path": "/budgets?month=13",
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

`message` es un texto o, en errores de validación, un arreglo de textos. Los errores internos (500) devuelven un mensaje genérico sin detalles.

### Paginación

Los listados paginados (`/transactions`, `/savings-goals`, `/savings-goals/:id/movements`) aceptan `?page=1&limit=20` (`limit` máximo 100) y responden:

```json
{ "data": [], "total": 0, "page": 1, "limit": 20 }
```

### Límite de peticiones

Hay un límite global de `THROTTLE_LIMIT` peticiones por `THROTTLE_TTL_MS` (por defecto 100 por minuto y cliente). `POST /auth/register` y `POST /auth/login` tienen un límite más estricto: **5 por minuto y por IP**. Al superarlo la API responde **429**.

### Otras reglas

- `DELETE` responde `{ "message": "..." }`.
- Las fechas sin hora son `YYYY-MM-DD`; los montos tienen como máximo 2 decimales (hasta 9 999 999 999.99).
- Un recurso de otro usuario responde 404.

## Endpoints

Todos requieren token salvo los marcados como **Público**. Además de los códigos indicados, cualquier endpoint puede responder **429** (límite de peticiones) y **500**.

### Auth

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| POST | `/auth/register` | Público | 201, 400, 409, 429 | Registra un usuario (crea sus categorías por defecto) y devuelve el token |
| POST | `/auth/login` | Público | 200, 400, 401, 429 | Inicia sesión y devuelve el token |
| GET | `/auth/me` | Token | 200, 401 | Devuelve el usuario del token |

### Users

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| GET | `/users/me` | Token | 200, 401 | Perfil propio |
| PATCH | `/users/me` | Token | 200, 400, 401, 409 | Actualiza nombre y/o email |
| PATCH | `/users/me/password` | Token | 200, 400, 401 | Cambia la contraseña (exige la actual) |
| DELETE | `/users/me` | Token | 200, 401 | Elimina la cuenta y todos sus datos |

### Categories

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| GET | `/categories` | Token | 200, 400, 401 | Lista las categorías propias por nombre (`?type=income\|expense`) |
| POST | `/categories` | Token | 201, 400, 401, 409 | Crea una categoría (`name`, `type`) |
| GET | `/categories/:id` | Token | 200, 400, 401, 404 | Obtiene una categoría |
| PATCH | `/categories/:id` | Token | 200, 400, 401, 404, 409 | Cambia el nombre (el tipo no se puede cambiar) |
| DELETE | `/categories/:id` | Token | 200, 400, 401, 404, 409 | Elimina una categoría (409 si tiene transacciones) |

### Transactions

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| GET | `/transactions` | Token | 200, 400, 401 | Lista paginada (`date DESC`). Filtros: `type`, `categoryId`, `from`, `to`, `page`, `limit` |
| POST | `/transactions` | Token | 201, 400, 401, 404 | Registra un ingreso o gasto; el tipo debe coincidir con el de la categoría |
| GET | `/transactions/:id` | Token | 200, 400, 401, 404 | Obtiene una transacción con su categoría |
| PATCH | `/transactions/:id` | Token | 200, 400, 401, 404 | Actualización parcial |
| DELETE | `/transactions/:id` | Token | 200, 400, 401, 404 | Elimina una transacción |

### Budgets

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| GET | `/budgets` | Token | 200, 400, 401 | Presupuestos de un mes (`?month=&year=`, por defecto el actual) con `spent`, `remaining`, `percentUsed` y `status` |
| POST | `/budgets` | Token | 201, 400, 401, 404, 409 | Crea un presupuesto (`categoryId` de gastos, `amount`, `month`, `year`) |
| GET | `/budgets/:id` | Token | 200, 400, 401, 404 | Obtiene un presupuesto con lo gastado |
| PATCH | `/budgets/:id` | Token | 200, 400, 401, 404 | Cambia solo el `amount` |
| DELETE | `/budgets/:id` | Token | 200, 400, 401, 404 | Elimina un presupuesto |

`status`: `ok`; `warning` si `percentUsed >= 80`; `exceeded` si `spent > amount`.

### Savings goals

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| GET | `/savings-goals` | Token | 200, 400, 401 | Lista paginada (`?status=active\|completed`) |
| POST | `/savings-goals` | Token | 201, 400, 401 | Crea una meta con saldo 0 |
| GET | `/savings-goals/:id` | Token | 200, 400, 401, 404 | Obtiene una meta con `status`, `progressPercent` y `remaining` |
| PATCH | `/savings-goals/:id` | Token | 200, 400, 401, 404 | Cambia nombre, objetivo o fecha límite |
| DELETE | `/savings-goals/:id` | Token | 200, 400, 401, 404 | Elimina la meta y su historial |
| POST | `/savings-goals/:id/deposits` | Token | 201, 400, 401, 404 | Deposita y registra el movimiento |
| POST | `/savings-goals/:id/withdrawals` | Token | 201, 400, 401, 404 | Retira (400 si no hay fondos) y registra el movimiento |
| GET | `/savings-goals/:id/movements` | Token | 200, 400, 401, 404 | Historial paginado (más reciente primero) |

### Health

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| GET | `/health` | Público | 200, 503 | `{ "status": "ok" }` si la API y la base de datos (`SELECT 1`) responden |

### Summary

Solo lectura. Todo se calcula con el `userId` del token (`SUM` + `GROUP BY` en Postgres). Mes y año por defecto: los actuales (UTC). `month` 1-12, `year` 2000-2100; cualquier otro valor o propiedad extra responde 400.

| Método | Ruta | Acceso | Códigos | Descripción |
|---|---|---|---|---|
| GET | `/summary` | Token | 200, 400, 401 | Resumen del mes (`?month=&year=`): `income`, `expenses`, `balance`, `savingsRate`, presupuestos por estado (`ok`/`warning`/`exceeded`) y progreso de metas (`totalSaved`, `totalTarget`, `active`, `completed`) |
| GET | `/summary/by-category` | Token | 200, 400, 401 | Total y porcentaje por categoría del mes, de mayor a menor (`?month=&year=&type=income\|expense`, por defecto `expense`) |
| GET | `/summary/monthly` | Token | 200, 400, 401 | Ingresos, gastos y balance de los 12 meses del año (`?year=`), con los meses sin datos en 0, y los totales del año |

- `savingsRate` = `balance / income * 100` (2 decimales); 0 si no hay ingresos y negativo si los gastos superan a los ingresos.
- Los porcentajes por categoría tienen 2 decimales y suman exactamente 100 (método del mayor resto).

## Seguridad

- Contraseñas con bcrypt (coste 12); `passwordHash` nunca se devuelve (`select: false`).
- Login con mensaje genérico (`Credenciales inválidas`) y tiempo de respuesta constante aunque el email no exista.
- `helmet` activo (compatible con Swagger en `/api`).
- CORS configurable con `CORS_ORIGIN`; desactivado por defecto en producción.
- La API se niega a arrancar en producción con `DB_SYNCHRONIZE=true`.
- Límite de peticiones global y más estricto en registro/login.
- Todas las consultas filtran por el `userId` del token; las pruebas unitarias verifican ese filtro en cada servicio.

## Documentación OpenAPI y Postman

- Swagger interactivo: <http://localhost:3000/api> (JSON en `/api-json`).
- `docs/openapi.json` es el documento exportado, listo para **importar en Postman** (*Import → File*). Se regenera con `npm run docs:openapi` (no necesita base de datos ni abre puertos). En Postman añade tu token como *Bearer Token*.

## Convenciones del proyecto

Consulta [`CLAUDE.md`](./CLAUDE.md) para las convenciones de código y el contrato de dominio.
