/**
 * Use `sqlite3` if you want a asynchronous SQLite client that supports promise.
Use `better-sqlite3` if you need a synchronous SQLite client that offers a simple and high performance API.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db_path = path.join(__dirname, '../../data/transit.db');
const schema_path = path.join(__dirname, '../../../data_schema.sql');

const db = new Database(db_path);
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(schema_path, 'utf-8');

try {
  db.exec(schema);
} catch (e) {
  throw new Error(`Failed to initialize database schema: ${(e as Error).message}`);
}

export default db;
