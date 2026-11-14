import dataSource from '../data-source';

/**
 * Seed mínimo: solo inicializa y cierra la conexión. El seed real con datos
 * de ejemplo se implementará en el PR final.
 */
async function seed() {
  await dataSource.initialize();
  await dataSource.destroy();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
