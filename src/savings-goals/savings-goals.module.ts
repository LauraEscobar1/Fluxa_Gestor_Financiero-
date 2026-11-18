import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsGoalMovement } from './entities/savings-goal-movement.entity';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SavingsGoalsController } from './savings-goals.controller';
import { SavingsGoalsService } from './savings-goals.service';

/**
 * Metas de ahorro con su historial de movimientos. Exporta
 * `SavingsGoalsService` para el módulo de resumen.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SavingsGoal, SavingsGoalMovement])],
  controllers: [SavingsGoalsController],
  providers: [SavingsGoalsService],
  exports: [SavingsGoalsService],
})
export class SavingsGoalsModule {}
