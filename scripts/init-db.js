/* Cria o banco (se não existir) e aplica db/schema.sql. Executado antes de `dev`/`start`. */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const cfg = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};
const database = process.env.PGDATABASE || 'cupcakes';

async function main() {
  const admin = new Client({ ...cfg, database: 'postgres' });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${database.replace(/"/g, '')}"`);
    console.log(`[db] Banco "${database}" criado.`);
  }
  await admin.end();

  const client = new Client({ ...cfg, database });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await client.query(sql);
  await client.end();
  console.log('[db] Tabelas verificadas/criadas com sucesso.');
}

main().catch((err) => {
  console.error('[db] Falha ao inicializar o banco:', err.message);
  process.exit(1);
});

