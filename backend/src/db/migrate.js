import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pool } from './pool.js';

export async function runMigrations() {
  const sql = readFileSync(new URL('../../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    await runMigrations();
    console.log('Schema applied');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
