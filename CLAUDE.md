# CLAUDE.md — Fluxa API

API REST de gestión financiera personal (NestJS 12 + TypeScript + TypeORM + PostgreSQL). Lee este archivo antes de implementar cualquier funcionalidad.

## Reglas de trabajo

- El control de versiones (git/GitHub) lo manejan las personas del equipo: **no ejecutes comandos de git ni de GitHub**.
- No cambies versiones de Nest, TypeScript o Jest, y no ejecutes `npm audit fix`, sin autorización.
- No cambies el contrato de dominio de abajo sin avisar.

## Convenciones

### Estructura de un módulo
Un módulo por carpeta (kebab-case): `dto/`, `entities/`, `x.controller.ts`, `x.module.ts`, `x.service.ts`, `x.service.spec.ts`.

### Capas
- **Controller**: sin lógica de negocio. Solo rutas, `ParseIntPipe` en ids, `@HttpCode` y decoradores Swagger (`@ApiTags`, `@ApiOperation`, `@ApiResponse` por cada código posible, `@ApiBearerAuth`).
- **Service**: usa `@InjectRepository`; retorno temprano lanzando `NotFoundException` / `ConflictException` / `BadRequestException`.
- **DTOs**: class-validator con mensajes en español y `@ApiProperty`. El DTO de update es `PartialType` de `@nestjs/swagger`.
- **Entidades**:
  - Tabla en plural snake_case; columnas con `name: 'snake_case'`.
  - `createdAt` / `updatedAt` con `@CreateDateColumn` / `@UpdateDateColumn`, tipo `timestamptz` y `default: () => 'CURRENT_TIMESTAMP'`.
  - Montos `decimal(12,2)` con `decimalTransformer` (`src/common/transformers`).

### Respuestas
- Listados paginados: `{ data, total, page, limit }` (usa `PaginationQueryDto`, `paginated()` y `pageOptions()` de `src/common/pagination.ts`).
- `DELETE` devuelve `{ message }`.
- Errores en el formato unificado del filtro global: `{ statusCode, error, message, path, timestamp }`.

### Estilo
- Comentarios JSDoc en español; identificadores en inglés; mensajes de error al usuario en español.
- Prettier (comillas simples, trailing comma `all`) y oxlint.

### Tests y calidad
- Cada PR incluye tests unitarios del servicio con repositorio simulado (patrón: `Test.createTestingModule` + `getRepositoryToken`) y, si aplica, e2e HTTP con servicio simulado y el `ValidationPipe` real.
- Deben pasar: `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`.
- Los scripts de Jest usan `--experimental-vm-modules` porque los paquetes de Nest 12 son ESM; no los llames con `npx jest` directamente.

### Base de datos
- **NO** se crean migraciones en los PR de funcionalidades (en desarrollo `DB_SYNCHRONIZE=true`). La migración inicial la genera el último PR.
- Configuración global en `src/main.ts` (filtro, `ValidationPipe`, Swagger en `/api`, sin prefijo global) y `src/app.module.ts` (Config, TypeORM, Throttler).

## Contrato de dominio

Los PR siguientes lo implementan; no lo cambies sin avisar.

- Todo recurso (salvo User) pertenece a un usuario mediante `userId` (FK a users, `onDelete: 'CASCADE'`). Toda consulta filtra por el `userId` del usuario autenticado; si el recurso es de otro usuario, responde 404.
- **User**: id, name, email (único, en minúsculas), passwordHash (`select: false`, nunca se devuelve), createdAt, updatedAt.
- **Category**: id, name (varchar 100), type (`'income' | 'expense'`), userId. Único (userId, type, name).
- **Transaction**: id, amount (decimal > 0), type (`'income' | 'expense'`), description (nullable), date (columna `date`, formato YYYY-MM-DD), categoryId (FK, `onDelete: 'RESTRICT'`), userId. El tipo de la transacción debe coincidir con el de la categoría. Índice (user_id, date).
- **Budget**: id, categoryId (solo categorías `'expense'`), amount (decimal > 0), month (1-12), year, userId. Único (userId, categoryId, month, year). Las respuestas incluyen `spent`, `remaining`, `percentUsed` y `status` (`'ok'` | `'warning'` si percentUsed >= 80 | `'exceeded'` si spent > amount), calculados con las transacciones de gasto de esa categoría y mes.
- **SavingsGoal**: id, name, targetAmount, currentAmount (default 0), targetDate (nullable), status (`'active' | 'completed'`, se calcula: completed cuando currentAmount >= targetAmount), userId. Historial en **SavingsGoalMovement**: id, goalId, amount, type (`'deposit' | 'withdrawal'`), createdAt.
- **Summary** (`/summary`): solo lectura; agrega transacciones, presupuestos y metas del usuario.
- **Auth**: JWT en el header `Authorization: Bearer <token>`; guard global con decorador `@Public()` para registro y login.

## Autenticación en los módulos

- `JwtAuthGuard` es **global** (`APP_GUARD` en `AuthModule`): toda ruta exige `Authorization: Bearer <token>` sin hacer nada. No añadas `@UseGuards` en los controladores.
- Usuario actual: `@CurrentUser()` (`src/auth/decorators/current-user.decorator.ts`) devuelve el `User` sin `passwordHash`; `@CurrentUser('id') userId: number` devuelve solo el id. Pásalo al servicio para filtrar por `userId`.
- `@Public()` (`src/auth/decorators/public.decorator.ts`) solo en rutas que deben funcionar sin sesión (hoy: `POST /auth/register` y `POST /auth/login`). Ningún endpoint de datos del usuario es público.
- Controladores protegidos: `@ApiBearerAuth()` y `@ApiResponse({ status: 401 })`.
- Contraseñas: `hashPassword` / `verifyPassword` de `src/common/password.ts` (bcrypt, cost 12); reglas de validación con `@IsValidPassword()`.
- Tests e2e de rutas protegidas: registra `{ provide: APP_GUARD, useClass: JwtAuthGuard }` con `JwtModule.register({ secret })` y un `UsersService` simulado (ver `test/auth.e2e-spec.ts`).

## Comandos útiles

```bash
docker compose up -d      # PostgreSQL (host:5433) y pgAdmin (5050)
npm run start:dev         # API en :3000, Swagger en /api
npm run lint && npm run build && npm test && npm run test:e2e
```
