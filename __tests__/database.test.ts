import Database from 'better-sqlite3';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS test_table (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value INTEGER
  );
`;

describe('better-sqlite3 DB Module', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);
  });

  afterAll(() => {
    db.close();
  });

  it('executes schema SQL without errors', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
      )
      .all();
    expect(tables.length).toBe(1);
    expect(tables[0].name).toBe('test_table');
  });

  it('inserts a row and returns lastInsertRowid', () => {
    const stmt = db.prepare('INSERT INTO test_table (name, value) VALUES (?, ?)');
    const info = stmt.run('test', 42);
    expect(info.lastInsertRowid).toBe(1n);
  });

  it('queries inserted data correctly', () => {
    const rows = db.prepare('SELECT * FROM test_table WHERE name = ?').all('test');
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('test');
    expect(rows[0].value).toBe(42);
  });

  it('runs multiple inserts', () => {
    const stmt = db.prepare('INSERT INTO test_table (name, value) VALUES (?, ?)');
    stmt.run('row2', 10);
    stmt.run('row3', 20);
    const count = db
      .prepare('SELECT COUNT(*) as count FROM test_table')
      .get() as { count: number };
    expect(count.count).toBe(3);
  });

  it('handles parameterized queries safely', () => {
    const rows = db
      .prepare('SELECT * FROM test_table WHERE value > ?')
      .all(15);
    expect(rows.length).toBe(2);
  });
});
