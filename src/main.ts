import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestLogger } from './common/middleware/request-logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(requestLogger);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fluxa API REST')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('categories')
    .addTag('transactions')
    .addTag('budgets')
    .addTag('savings-goals')
    .addTag('summary')
    .build();
  SwaggerModule.setup(
    'api',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API disponible en http://localhost:${port}`);
  logger.log(`Swagger disponible en http://localhost:${port}/api`);
}
void bootstrap();
