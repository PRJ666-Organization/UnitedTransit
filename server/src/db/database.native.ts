import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('transit.db');
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  const statements = SCHEMA_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execAsync(statement + ';');
  }

  console.log('✅ Database initialized (native)');
  return db;
}

export async function runQuery(sql: string, params: any[] = []): Promise<any[]> {
  const database = await getDatabase();
  return await database.getAllAsync(sql, params);
}

export async function runMutation(sql: string, params: any[] = []): Promise<any> {
  const database = await getDatabase();
  return await database.runAsync(sql, params);
}
