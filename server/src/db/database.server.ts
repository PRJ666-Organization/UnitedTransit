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
  } catch {
    // Column already exists, ignore
  }

  // Migration: add is_verified column if it doesn't exist
  try {
    db.exec('ALTER TABLE user ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;');
  } catch {
    // Column already exists, ignore
  }

  // Migration: add is_verified check constraint (best-effort)
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_verified ON user (is_verified);');
  } catch {
    // Index already exists, ignore
  }

  // Migration: create search_history table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        search_id       INTEGER NOT NULL,
        user_id         INTEGER,
        locations_json  TEXT    NOT NULL,
        searched_at     TEXT    NOT NULL,
        device_id       TEXT,
        CONSTRAINT pk_search_history PRIMARY KEY (search_id AUTOINCREMENT),
        CONSTRAINT fk_search_user
            FOREIGN KEY (user_id) REFERENCES user (user_id)
            ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history (user_id);
      CREATE INDEX IF NOT EXISTS idx_search_history_device ON search_history (device_id);
    `);
  } catch {
    // Table already exists, ignore
  }

  // Migration: create active_trip_session table for real-time tracking
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS active_trip_session (
        session_id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        user_id            INTEGER,
        device_id          TEXT,
        trip_id            INTEGER,
        status             TEXT NOT NULL DEFAULT 'active',
        started_at         TEXT NOT NULL,
        last_updated       TEXT NOT NULL,
        current_segment    INTEGER DEFAULT 0,
        current_stop_index INTEGER DEFAULT 0,
        locations_json     TEXT,
        selected_routes_json TEXT,
        FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
        FOREIGN KEY (trip_id) REFERENCES trip(trip_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_active_trip_user ON active_trip_session(user_id);
      CREATE INDEX IF NOT EXISTS idx_active_trip_device ON active_trip_session(device_id);
    `);
  } catch {
    // Table already exists, ignore
  }

  // Migration: create trip_location_update table for location tracking
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trip_location_update (
        update_id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        session_id         INTEGER NOT NULL,
        latitude           REAL NOT NULL,
        longitude          REAL NOT NULL,
        accuracy           REAL,
        timestamp          TEXT NOT NULL,
        eta_minutes        REAL,
        distance_to_next_stop REAL,
        FOREIGN KEY (session_id) REFERENCES active_trip_session(session_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_trip_location_session ON trip_location_update(session_id);
      CREATE INDEX IF NOT EXISTS idx_trip_location_time ON trip_location_update(timestamp);
    `);
  } catch {
    // Table already exists, ignore
  }

  // Migration: create trip_delay_event table for delay detection
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trip_delay_event (
        event_id           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        session_id         INTEGER NOT NULL,
        event_type         TEXT NOT NULL,
        severity           TEXT NOT NULL,
        description        TEXT,
        vehicle_id         TEXT,
        route_affected     TEXT,
        delay_minutes      INTEGER,
        reroute_options_json TEXT,
        created_at         TEXT NOT NULL,
        resolved_at        TEXT,
        FOREIGN KEY (session_id) REFERENCES active_trip_session(session_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_delay_event_session ON trip_delay_event(session_id);
      CREATE INDEX IF NOT EXISTS idx_delay_event_time ON trip_delay_event(created_at);
    `);
  } catch {
    // Table already exists, ignore
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
