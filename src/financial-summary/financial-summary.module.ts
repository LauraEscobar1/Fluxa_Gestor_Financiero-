import { Module } from '@nestjs/common';
import { FinancialSummaryController } from './financial-summary.controller';

@Module({
  controllers: [FinancialSummaryController],
})
export class FinancialSummaryModule {}
