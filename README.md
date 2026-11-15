# Fluxa API

API REST de **gestión financiera personal**: permite a cada usuario registrar sus ingresos y gastos, organizarlos por categorías, definir presupuestos mensuales, gestionar metas de ahorro y consultar un resumen financiero.

## Stack

- [NestJS](https://nestjs.com/) 12 + TypeScript
- PostgreSQL 15 con [TypeORM](https://typeorm.io/)
- Validación con `class-validator` / `class-transformer`
- Documentación con Swagger (`@nestjs/swagger`)
- Limitación de peticiones con `@nestjs/throttler`
- Jest + Supertest (pruebas), oxlint (lint), Prettier (formato)
- Docker Compose (PostgreSQL + pgAdmin para desarrollo)

## Requisitos

- Node.js 24+ y npm
- Docker y Docker Compose

## Cómo levantar el proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de variables de entorno
cp .env.example .env

# 3. Levantar PostgreSQL y pgAdmin
docker compose up -d

# 4. Iniciar la API en modo desarrollo
npm run start:dev
```

- API: <http://localhost:3000>
- Swagger: <http://localhost:3000/api>
- pgAdmin: <http://localhost:5050> (credenciales en `.env`; para conectarse a la base usa host `postgres`, puerto `5432`)

## Variables de entorno

Se definen en `.env` (ver `.env.example`).

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto de la API | `3000` |
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL en el host | `5433` |
| `DB_USERNAME` | Usuario de la base de datos | `fluxa_user` |
| `DB_PASSWORD` | Contraseña de la base de datos | `fluxa_password` |
| `DB_NAME` | Nombre de la base de datos | `fluxa_db` |
| `DB_SYNCHRONIZE` | Sincroniza tablas con las entidades (**solo desarrollo**) | `true` |
| `DB_MIGRATIONS_RUN` | Ejecuta migraciones al iniciar | `false` |
| `JWT_SECRET` | Secreto para firmar los tokens (**obligatorio**, la API no arranca sin él; cámbialo) | — |
| `JWT_EXPIRES_IN` | Duración del token (`15m`, `1h`, `7d` o segundos) | `1h` |
| `PGADMIN_EMAIL` | Usuario de pgAdmin | `admin@fluxa.com` |
| `PGADMIN_PASSWORD` | Contraseña de pgAdmin | `admin123` |
| `PGADMIN_PORT` | Puerto de pgAdmin | `5050` |
| `THROTTLE_TTL_MS` | Ventana del límite de peticiones (ms) | `60000` |
| `THROTTLE_LIMIT` | Peticiones máximas por ventana | `100` |

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
| `npm run test:cov` | Pruebas con cobertura |
| `npm run migration:generate -- src/database/migrations/Nombre` | Genera una migración |
| `npm run migration:run` | Ejecuta las migraciones pendientes |
| `npm run migration:revert` | Revierte la última migración |
| `npm run seed` | Ejecuta el seed de datos de ejemplo |

## Pruebas

```bash
npm test          # unitarias (no requieren base de datos)
npm run test:e2e  # e2e (no requieren base de datos)
```

Los scripts de Jest usan `--experimental-vm-modules` porque los paquetes de Nest 12 se publican como módulos ESM.

## Endpoints

Los endpoints se documentan en cada PR de funcionalidad y se consolidarán al final. Mientras tanto, la referencia viva está en Swagger (`/api`).

## Convenciones del proyecto

Consulta [`CLAUDE.md`](./CLAUDE.md) para las convenciones de código y el contrato de dominio.
