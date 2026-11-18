import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { assertSafeDatabaseConfig } from './common/config/runtime-config';
import { FinancialSummaryModule } from './financial-summary/financial-summary.module';
import { HealthModule } from './health/health.module';
import { SavingsGoalsModule } from './savings-goals/savings-goals.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

/**
 * Módulo raíz de Fluxa. Configura variables de entorno, base de datos,
 * limitación de peticiones y registra los módulos de dominio.
 */
@Module({
  imports: [
    /**
     * Carga el archivo `.env` y expone `ConfigService` en toda la aplicación
     * sin tener que importar `ConfigModule` en cada módulo (`isGlobal`).
     */
    ConfigModule.forRoot({ isGlobal: true }),

    /**
     * Conexión a PostgreSQL. Es asíncrona para leer los valores desde
     * `ConfigService` una vez que `.env` ya fue cargado.
     */
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Se niega a arrancar en producción con `synchronize` activado.
        assertSafeDatabaseConfig({
          NODE_ENV: config.get<string>('NODE_ENV'),
          DB_SYNCHRONIZE: config.get<string>('DB_SYNCHRONIZE'),
        });
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST'),
          // Las variables de entorno son texto; el puerto debe ser numérico.
          port: Number(config.get('DB_PORT')),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
          // Registra automáticamente las entidades declaradas con
          // `TypeOrmModule.forFeature` en cada módulo.
          autoLoadEntities: true,
          // Crea/actualiza las tablas a partir de las entidades. Es cómodo en
          // desarrollo pero puede borrar datos: NUNCA activarlo en producción
          // (allí se usan migraciones).
          synchronize: config.get('DB_SYNCHRONIZE') === 'true',
          // Ubicación de las migraciones (ts en desarrollo, js tras compilar).
          migrations: [join(__dirname, 'database', 'migrations', '*.{ts,js}')],
          // Ejecuta las migraciones pendientes al iniciar; en producción debe
          // ser `true` y `synchronize` debe ser `false`.
          migrationsRun: config.get('DB_MIGRATIONS_RUN') === 'true',
        };
      },
    }),

    /**
     * Límite de peticiones por ventana de tiempo para mitigar abuso y
     * fuerza bruta. Valores configurables por entorno.
     */
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            // Duración de la ventana en milisegundos.
            ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60000),
            // Máximo de peticiones permitidas por ventana y cliente.
            limit: Number(config.get('THROTTLE_LIMIT') ?? 100),
          },
        ],
        errorMessage: 'Demasiadas peticiones, intenta de nuevo más tarde',
      }),
    }),

    AuthModule,
    BudgetsModule,
    CategoriesModule,
    FinancialSummaryModule,
    HealthModule,
    SavingsGoalsModule,
    TransactionsModule,
    UsersModule,
  ],
  providers: [
    // Aplica el límite de peticiones a todas las rutas de la API.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
