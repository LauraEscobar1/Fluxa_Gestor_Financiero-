# Fluxa API

API REST de **gestión financiera personal**. Cada usuario registra sus ingresos y gastos, los organiza por categorías, define presupuestos mensuales con seguimiento del gasto real, gestiona metas de ahorro con su historial y consulta un resumen de su situación, todo de forma aislada de los demás usuarios.

## Contenido

- [Funcionalidades](#funcionalidades)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Modelo de datos](#modelo-de-datos)
- [Requisitos previos](#requisitos-previos)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Autenticación](#autenticación)
- [Endpoints](#endpoints)
- [Convenciones de respuesta](#convenciones-de-respuesta)
- [Scripts](#scripts)
- [Base de datos: migraciones y seed](#base-de-datos-migraciones-y-seed)
- [Pruebas](#pruebas)
- [Swagger y Postman](#swagger-y-postman)
- [Seguridad](#seguridad)
- [Contribución](#contribución)

## Funcionalidades

- **Autenticación** con registro, login y JWT; gestión del perfil propio (nombre, email, contraseña) y eliminación de la cuenta.
- **Categorías** de ingreso y gasto (se crean unas por defecto al registrarse).
- **Transacciones** de ingreso y gasto con filtros por tipo, categoría y rango de fechas, y paginación.
- **Presupuestos mensuales** por categoría de gasto, con lo gastado, lo restante, el porcentaje usado y un estado (`ok`, `warning`, `exceeded`).
- **Metas de ahorro** con depósitos, retiros e historial de movimientos.
- **Resumen financiero** (`/summary`): balance del mes, gasto por categoría y evolución anual.
- **Health check** público (`/health`) que comprueba la base de datos.
- Documentación **OpenAPI/Swagger**, seed de datos demo y migraciones de base de datos.

## Stack tecnológico

- [NestJS](https://nestjs.com/) 12 + TypeScript
- PostgreSQL 15 con [TypeORM](https://typeorm.io/)
- Validación con `class-validator` / `class-transformer`
- Autenticación JWT (`@nestjs/jwt`) y contraseñas con `bcrypt`
- Documentación con Swagger (`@nestjs/swagger`)
- Limitación de peticiones con `@nestjs/throttler` y cabeceras de seguridad con `helmet`
- Jest + Supertest (pruebas), oxlint (lint) y Prettier (formato)
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
├── users/                     # perfil propio (/users/me)
├── categories/                # categorías (+ categorías por defecto al registrarse)
├── transactions/              # ingresos y gastos
├── budgets/                   # presupuestos mensuales con gasto calculado
├── savings-goals/             # metas de ahorro, depósitos, retiros e historial
├── financial-summary/         # resumen del dashboard (/summary)
├── health/                    # GET /health
├── common/                    # filtro de errores, paginación, fechas, números, password, config, swagger
├── database/
│   ├── data-source.ts         # DataSource del CLI de TypeORM
│   ├── migrations/            # migraciones (InitialSchema)
│   └── seeds/                 # seed de datos demo
└── docs/export-openapi.ts     # exporta docs/openapi.json
test/                          # pruebas e2e HTTP (servicios simulados)
docs/
├── openapi.json               # documento OpenAPI para Postman
└── CONVENTIONS.md             # convenciones de código y contrato de dominio
```

Cada módulo sigue la misma forma: `dto/`, `entities/`, `x.controller.ts`, `x.module.ts`, `x.service.ts` y `x.service.spec.ts`.

## Modelo de datos

```
User 1───* Category 1───* Transaction
  │            │
  │            └───* Budget
  ├───* Transaction
  ├───* Budget
  └───* SavingsGoal 1───* SavingsGoalMovement
```

| Entidad | Campos principales | Restricciones |
|---|---|---|
| **User** | `id`, `name`, `email`, `passwordHash`, `createdAt`, `updatedAt` | `email` único y en minúsculas; `passwordHash` nunca se devuelve |
| **Category** | `id`, `name` (hasta 100), `type` (`income`/`expense`), `userId` | Único (`userId`, `type`, `name`) |
| **Transaction** | `id`, `amount`, `type`, `description`, `date`, `categoryId`, `userId` | Índice (`user_id`, `date`); FK a categoría con `RESTRICT` |
| **Budget** | `id`, `categoryId`, `amount`, `month`, `year`, `userId` | Único (`userId`, `categoryId`, `month`, `year`) |
| **SavingsGoal** | `id`, `name`, `targetAmount`, `currentAmount`, `targetDate`, `userId` | `currentAmount` solo cambia con depósitos y retiros |
| **SavingsGoalMovement** | `id`, `goalId`, `amount`, `type` (`deposit`/`withdrawal`), `createdAt` | Se elimina junto con la meta |

Todos los recursos (salvo User) pertenecen a un usuario con FK `ON DELETE CASCADE`: al eliminar la cuenta se borran sus datos.

**Reglas de negocio**

- El tipo de una transacción debe coincidir con el de su categoría.
- Una categoría con transacciones no se puede eliminar (409). El tipo de una categoría no se puede cambiar.
- Los presupuestos solo se crean sobre categorías de **gasto**; hay uno por categoría, mes y año. Solo se puede editar su `amount`.
- `status` de un presupuesto: `exceeded` si lo gastado supera el monto; `warning` si el porcentaje usado es 80 % o más; `ok` en otro caso. `remaining` puede ser negativo.
- Una meta de ahorro está `completed` cuando `currentAmount >= targetAmount`; un retiro mayor al saldo responde 400.
- Montos positivos con máximo 2 decimales (hasta 9 999 999 999.99). Fechas sin hora en formato `YYYY-MM-DD`; "hoy" se calcula en UTC, pero el mes y el año por defecto de presupuestos y resumen se calculan en la zona `America/Bogota`.

## Requisitos previos

- Node.js 24+ y npm
- Docker y Docker Compose

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de variables de entorno y definir JWT_SECRET (vacío en .env.example)
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
| `JWT_SECRET` | Secreto para firmar los tokens (**obligatorio**, la API no arranca sin él; genera uno largo y aleatorio, p. ej. `openssl rand -base64 48`) | vacío |
| `JWT_EXPIRES_IN` | Duración del token (`15m`, `1h`, `7d` o segundos) | `1h` |
| `CORS_ORIGIN` | Orígenes permitidos separados por comas. Sin definir: abierto en desarrollo y desactivado en producción | vacío |
| `THROTTLE_TTL_MS` | Ventana del límite de peticiones (ms) | `60000` |
| `THROTTLE_LIMIT` | Peticiones máximas por ventana y cliente | `100` |
| `PGADMIN_EMAIL` | Usuario de pgAdmin | `admin@fluxa.com` |
| `PGADMIN_PASSWORD` | Contraseña de pgAdmin | `admin123` |
| `PGADMIN_PORT` | Puerto de pgAdmin | `5050` |

## Autenticación

1. **Registrarse:** `POST /auth/register` con `{ "name", "email", "password" }`. Crea el usuario con sus categorías por defecto y devuelve `{ accessToken, user }`.
2. **Iniciar sesión:** `POST /auth/login` con `{ "email", "password" }`. Devuelve `{ accessToken, user }`.
3. **Usar el token:** envíalo en cada petición protegida:

```http
Authorization: Bearer <accessToken>
```

Sin token, con un token inválido o expirado, o de una cuenta eliminada, la API responde **401**. Solo son públicas `POST /auth/register`, `POST /auth/login` y `GET /health`.

## Endpoints

Todos requieren token salvo los marcados como **Público**. Además de los códigos indicados, cualquier endpoint puede responder **429** (límite de peticiones) y **500**. Los endpoints con `:id` responden 400 si el id no es un entero.

### Auth

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| POST | `/auth/register` | Público | body: `name`, `email`, `password` | 201, 400, 409, 429 | Registra un usuario (crea sus categorías por defecto) y devuelve el token |
| POST | `/auth/login` | Público | body: `email`, `password` | 200, 400, 401, 429 | Inicia sesión y devuelve el token |
| GET | `/auth/me` | Token | — | 200, 401 | Devuelve el usuario del token |

### Users

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| GET | `/users/me` | Token | — | 200, 401 | Perfil propio |
| PATCH | `/users/me` | Token | body: `name?`, `email?` | 200, 400, 401, 409 | Actualiza nombre y/o email |
| PATCH | `/users/me/password` | Token | body: `currentPassword`, `newPassword` | 200, 400, 401 | Cambia la contraseña (exige la actual) |
| DELETE | `/users/me` | Token | — | 200, 401 | Elimina la cuenta y todos sus datos |

### Categories

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| GET | `/categories` | Token | query: `type?` (`income`/`expense`) | 200, 400, 401 | Lista las categorías propias por nombre |
| POST | `/categories` | Token | body: `name`, `type` | 201, 400, 401, 409 | Crea una categoría |
| GET | `/categories/:id` | Token | — | 200, 400, 401, 404 | Obtiene una categoría |
| PATCH | `/categories/:id` | Token | body: `name` | 200, 400, 401, 404, 409 | Cambia el nombre (el tipo no se puede cambiar) |
| DELETE | `/categories/:id` | Token | — | 200, 400, 401, 404, 409 | Elimina una categoría (409 si tiene transacciones) |

### Transactions

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| GET | `/transactions` | Token | query: `type?`, `categoryId?`, `from?`, `to?`, `page?`, `limit?` | 200, 400, 401 | Lista paginada (`date` descendente) |
| POST | `/transactions` | Token | body: `amount`, `type`, `categoryId`, `date`, `description?` | 201, 400, 401, 404 | Registra un ingreso o gasto; el tipo debe coincidir con el de la categoría |
| GET | `/transactions/:id` | Token | — | 200, 400, 401, 404 | Obtiene una transacción con su categoría |
| PATCH | `/transactions/:id` | Token | body: cualquiera de los campos del POST | 200, 400, 401, 404 | Actualización parcial |
| DELETE | `/transactions/:id` | Token | — | 200, 400, 401, 404 | Elimina una transacción |

### Budgets

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| GET | `/budgets` | Token | query: `month?`, `year?` (por defecto el actual) | 200, 400, 401 | Presupuestos del mes con `spent`, `remaining`, `percentUsed` y `status` |
| POST | `/budgets` | Token | body: `categoryId` (de gasto), `amount`, `month`, `year` | 201, 400, 401, 404, 409 | Crea un presupuesto |
| GET | `/budgets/:id` | Token | — | 200, 400, 401, 404 | Obtiene un presupuesto con lo gastado |
| PATCH | `/budgets/:id` | Token | body: `amount` | 200, 400, 401, 404 | Cambia solo el monto |
| DELETE | `/budgets/:id` | Token | — | 200, 400, 401, 404 | Elimina un presupuesto |

### Savings goals

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| GET | `/savings-goals` | Token | query: `status?` (`active`/`completed`), `page?`, `limit?` | 200, 400, 401 | Lista paginada |
| POST | `/savings-goals` | Token | body: `name`, `targetAmount`, `targetDate?` | 201, 400, 401 | Crea una meta con saldo 0 |
| GET | `/savings-goals/:id` | Token | — | 200, 400, 401, 404 | Obtiene una meta con `status`, `progressPercent` y `remaining` |
| PATCH | `/savings-goals/:id` | Token | body: `name?`, `targetAmount?`, `targetDate?` | 200, 400, 401, 404 | Cambia nombre, objetivo o fecha límite |
| DELETE | `/savings-goals/:id` | Token | — | 200, 400, 401, 404 | Elimina la meta y su historial |
| POST | `/savings-goals/:id/deposits` | Token | body: `amount` | 201, 400, 401, 404 | Deposita y registra el movimiento |
| POST | `/savings-goals/:id/withdrawals` | Token | body: `amount` | 201, 400, 401, 404 | Retira (400 si no hay fondos) y registra el movimiento |
| GET | `/savings-goals/:id/movements` | Token | query: `page?`, `limit?` | 200, 400, 401, 404 | Historial paginado (más reciente primero) |

### Summary

Solo lectura. Todo se calcula con el `userId` del token. Mes y año por defecto: los actuales en `America/Bogota`; `month` 1-12 y `year` 2000-2100.

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| GET | `/summary` | Token | query: `month?`, `year?` | 200, 400, 401 | Resumen del mes: `income`, `expenses`, `balance`, `savingsRate`, presupuestos por estado y progreso de metas |
| GET | `/summary/by-category` | Token | query: `month?`, `year?`, `type?` (por defecto `expense`) | 200, 400, 401 | Total y porcentaje por categoría, de mayor a menor |
| GET | `/summary/monthly` | Token | query: `year?` | 200, 400, 401 | Ingresos, gastos y balance de los 12 meses (los meses sin datos en 0) y totales del año |

- `savingsRate` = `balance / income * 100` (2 decimales); 0 si no hay ingresos y negativo si los gastos superan a los ingresos.
- Los porcentajes por categoría tienen 2 decimales y suman exactamente 100.

### Health

| Método | Ruta | Acceso | Parámetros / body | Códigos | Descripción |
|---|---|---|---|---|---|
| GET | `/health` | Público | — | 200, 503 | `{ "status": "ok" }` si la API y la base de datos responden |

## Convenciones de respuesta

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

`message` es un texto o, en errores de validación, un arreglo de textos. Los errores internos (500) devuelven un mensaje genérico sin detalles. Las propiedades desconocidas en el body se rechazan con 400.

### Paginación

Los listados paginados (`/transactions`, `/savings-goals`, `/savings-goals/:id/movements`) aceptan `?page=1&limit=20` (`limit` máximo 100) y responden:

```json
{ "data": [], "total": 0, "page": 1, "limit": 20 }
```

### Límite de peticiones (429)

Hay un límite global de `THROTTLE_LIMIT` peticiones por `THROTTLE_TTL_MS` (por defecto 100 por minuto y cliente). `POST /auth/register` y `POST /auth/login` tienen un límite más estricto: **5 por minuto y por IP**. Al superarlo la API responde **429**.

### Otras reglas

- `DELETE` responde `{ "message": "..." }`.
- Un recurso de otro usuario responde 404.

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

El esquema completo está en `src/database/migrations/` (migración `InitialSchema`): tablas, enums (`category_type`, `savings_goal_movement_type`), únicos, índices y claves foráneas con su `onDelete`.

- **Desarrollo:** `DB_SYNCHRONIZE=true` crea las tablas solas.
- **Producción (o cualquier base nueva con migraciones):**

```bash
# .env: DB_SYNCHRONIZE=false  (y NODE_ENV=production si corresponde)
npm run migration:run      # crea el esquema
npm run start:prod         # o DB_MIGRATIONS_RUN=true para migrar al arrancar
```

- Para volver atrás: `npm run migration:revert`.
- Si cambias una entidad, genera una migración nueva con `migration:generate` y revisa el SQL: si dos entidades comparten un enum, TypeORM puede crearlo dos veces (pasó con `category_type` y se corrigió a mano en `InitialSchema`).
- Para empezar de cero en desarrollo: `docker compose down -v && docker compose up -d`.

### Seed de datos demo

`npm run seed` crea, en una sola transacción, el usuario `demo@fluxa.com` / `Demo1234`, sus categorías por defecto, 40 transacciones de los últimos 3 meses, 3 presupuestos del mes actual (uno en `warning`, uno `exceeded` y uno `ok`) y 2 metas de ahorro con movimientos. Es idempotente (si el usuario existe no hace nada) y se niega a correr con `NODE_ENV=production`. Requiere que las tablas ya existan.

## Pruebas

```bash
npm test          # unitarias de servicios y utilidades (sin base de datos)
npm run test:e2e  # e2e HTTP: controladores reales, servicios simulados, ValidationPipe y guard JWT reales
npm run test:cov  # unitarias con cobertura (carpeta coverage/)
```

Los scripts de Jest usan `--experimental-vm-modules` porque los paquetes de Nest 12 se publican como módulos ESM; no los llames con `npx jest` directamente.

## Swagger y Postman

- **Swagger interactivo:** <http://localhost:3000/api> (JSON en `/api-json`). Usa el botón *Authorize* con el `accessToken`.
- **Postman:** *Import → File* y selecciona `docs/openapi.json`. Después, en la colección, configura *Authorization → Bearer Token* con el `accessToken` de `/auth/login`.
- `docs/openapi.json` se regenera con `npm run docs:openapi` (no necesita base de datos ni abre puertos).

## Seguridad

- Contraseñas con bcrypt (coste 12); `passwordHash` nunca se devuelve (`select: false`).
- Login con mensaje genérico (`Credenciales inválidas`) y tiempo de respuesta constante aunque el email no exista.
- `helmet` activo (compatible con Swagger en `/api`).
- CORS configurable con `CORS_ORIGIN`; desactivado por defecto en producción.
- La API se niega a arrancar en producción con `DB_SYNCHRONIZE=true`.
- Límite de peticiones global y más estricto en registro/login.
- Todas las consultas filtran por el `userId` del token; las pruebas unitarias verifican ese filtro en cada servicio.

## Contribución

Antes de proponer cambios lee [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md): estructura de módulos, capas, convenciones de entidades y DTO, contrato de dominio y requisitos de pruebas. Cada cambio debe pasar `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e`, y, si toca endpoints, actualizar `docs/openapi.json` y la tabla de endpoints de este archivo.
