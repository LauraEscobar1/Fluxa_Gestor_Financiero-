import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from '../common/swagger';

/**
 * Escribe el documento OpenAPI en `docs/openapi.json` (o en la ruta del primer
 * argumento) para importarlo en Postman. Usa `preview: true`: registra rutas y
 * DTOs sin instanciar providers, así que no abre conexión a la base de datos
 * ni escucha en ningún puerto.
 */
async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const output = resolve(process.argv[2] ?? 'docs/openapi.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(createOpenApiDocument(app), null, 2) + '\n',
  );
  await app.close();
  console.log(`OpenAPI exportado en ${output}`);
}

exportOpenApi().catch((error) => {
  console.error(error);
  process.exit(1);
});
