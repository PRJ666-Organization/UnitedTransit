import initSqlJs, { Database } from 'sql.js';
import { SCHEMA_SQL } from './schema';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm', // serve locally instead of CDN
  });

  db = new SQL.Database();

  const statements = SCHEMA_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    db.run(statement + ';');
  }

  console.log('✅ Database initialized (web)');
  return db;
}

export async function runQuery(sql: string, params: any[] = []): Promise<any[]> {
  const database = await getDatabase();
  const results = database.exec(sql, params);
  if (!results.length) return [];

  const { columns, values } = results[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

export async function runMutation(sql: string, params: any[] = []): Promise<any> {
  const database = await getDatabase();
  database.run(sql, params);
  return { lastInsertRowId: database.exec('SELECT last_insert_rowid()')[0]?.values[0][0] };
}
