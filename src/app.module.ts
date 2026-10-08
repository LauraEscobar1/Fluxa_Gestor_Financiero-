import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { FinancialSummaryModule } from './financial-summary/financial-summary.module';
import { SavingsGoalsModule } from './savings-goals/savings-goals.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    AuthModule,
    BudgetsModule,
    CategoriesModule,
    FinancialSummaryModule,
    SavingsGoalsModule,
    TransactionsModule,
    UsersModule,
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'fluxa-nest.js',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
