import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetsModule } from '../budgets/budgets.module';
import { SavingsGoalsModule } from '../savings-goals/savings-goals.module';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FinancialSummaryController } from './financial-summary.controller';
import { FinancialSummaryService } from './financial-summary.service';

/**
 * Resumen financiero (`/summary`). Agrega las transacciones con su propio
 * repositorio (`forFeature([Transaction])`) y reutiliza `BudgetsService` y
 * `SavingsGoalsService`. Las importaciones van en una sola dirección: ningún
 * otro módulo importa este, así que no hay dependencias circulares.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    BudgetsModule,
    SavingsGoalsModule,
  ],
  controllers: [FinancialSummaryController],
  providers: [FinancialSummaryService],
})
export class FinancialSummaryModule {}
