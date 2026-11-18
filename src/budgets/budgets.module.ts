import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { Transaction } from '../transactions/entities/transaction.entity';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { Budget } from './entities/budget.entity';

/**
 * Presupuestos mensuales. Lee las transacciones con su propio repositorio
 * (`forFeature([Transaction])`) para calcular lo gastado, sin depender de
 * `TransactionsModule`, e importa `CategoriesModule` para validar categorías.
 * Exporta `BudgetsService` para el módulo de resumen.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Budget, Transaction]), CategoriesModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
