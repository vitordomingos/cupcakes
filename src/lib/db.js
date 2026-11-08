import { Pool } from 'pg';

// Reaproveita o pool entre hot-reloads do Next em desenvolvimento.
const globalForPg = globalThis;

export const pool =
  globalForPg.__pgPool ||
  new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'cupcakes',
  });

if (process.env.NODE_ENV !== 'production') globalForPg.__pgPool = pool;

export const query = (text, params) => pool.query(text, params);

