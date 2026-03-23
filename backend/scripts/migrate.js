import { readdir, readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const { Client } = pg;

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedVersions(client) {
  const { rows } = await client.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return new Set(rows.map((r) => r.version));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definido. Copie env.template para .env na raiz.');
    process.exit(1);
  }

  const migrationsDir = join(__dirname, '../migrations');
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedVersions(client);

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;

      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          version,
        ]);
        await client.query('COMMIT');
        console.log(`OK  ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    console.log('Migrações concluídas.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
