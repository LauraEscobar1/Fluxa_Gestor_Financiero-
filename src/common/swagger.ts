import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Genera el documento OpenAPI de la API (lo usan `main.ts` y `docs:openapi`). */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
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
    .addTag('health')
    .build();
  return SwaggerModule.createDocument(app, config);
}
