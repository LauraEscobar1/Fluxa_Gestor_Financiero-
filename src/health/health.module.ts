import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Endpoint público de salud. `DataSource` lo provee `TypeOrmModule` (global). */
@Module({ controllers: [HealthController] })
export class HealthModule {}
