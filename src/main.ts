import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './common/config/runtime-config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestLogger } from './common/middleware/request-logger.middleware';
import { createOpenApiDocument } from './common/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Cabeceras de seguridad HTTP. La política por defecto de helmet es
  // compatible con Swagger UI (scripts y estilos propios, sin CDN).
  app.use(helmet());

  // CORS: lista en CORS_ORIGIN; sin ella, abierto en desarrollo y
  // desactivado en producción.
  const origin = resolveCorsOrigin({
    NODE_ENV: config.get<string>('NODE_ENV'),
    CORS_ORIGIN: config.get<string>('CORS_ORIGIN'),
  });
  if (origin) {
    app.enableCors({ origin });
  }

  app.use(requestLogger);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  SwaggerModule.setup('api', app, createOpenApiDocument(app));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API disponible en http://localhost:${port}`);
  logger.log(`Swagger disponible en http://localhost:${port}/api`);
}
void bootstrap();
