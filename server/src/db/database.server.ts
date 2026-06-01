import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { SCHEMA_SQL } from './schema';


const DB_PATH = path.join(__dirname, '..', '..', 'data', 'transit.db');

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let db: Database.Database | null = null;

export async function getDatabase(): Promise<Database.Database> {
  if (db) return db;

  ensureDataDir();

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const statements = SCHEMA_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    db.exec(statement + ';');
  }

  // Migration: add locations_json column if it doesn't exist
  try {
    db.exec('ALTER TABLE bookmark ADD COLUMN locations_json TEXT;');
    //db.exec('ALTER TABLE user ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;'); // user email
    //this won't work
  } catch {
    // Column already exists, ignore
  }

  console.log('Database initialized (server) at', DB_PATH);
  return db;
}

export async function runQuery(sql: string, params: any[] = []): Promise<any[]> {
  const database = await getDatabase();
  const stmt = database.prepare(sql);
  const results = stmt.all(...params);
  return results as any[];
}

export async function runMutation(sql: string, params: any[] = []): Promise<any> {
  const database = await getDatabase();
  const stmt = database.prepare(sql);
  const info = stmt.run(...params);
  return { lastInsertRowId: info.lastInsertRowid };
}

export async function runTransaction(
  callback: (database: Database.Database) => void,
): Promise<void> {
  const database = await getDatabase();

  const transaction = database.transaction(() => {
    callback(database);
  });

  transaction();
}
