import Database from 'better-sqlite3';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS transit_agency (
    agency_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    api_endpoint TEXT NOT NULL,
    update_frequency INTEGER NOT NULL,
    update_frequency_unit TEXT NOT NULL DEFAULT 'MINUTES',
    CONSTRAINT pk_transit_agency PRIMARY KEY (agency_id AUTOINCREMENT),
    CONSTRAINT chk_update_frequency_unit CHECK (update_frequency_unit IN ('MINUTES', 'SECONDS'))
  );

  CREATE TABLE IF NOT EXISTS service_alert (
    alert_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL,
    description TEXT,
    start_time REAL,
    end_time REAL,
    severity INTEGER,
    CONSTRAINT pk_service_alert PRIMARY KEY (alert_id AUTOINCREMENT),
    CONSTRAINT chk_alert_type CHECK (alert_type IN ('DELAY', 'CLOSURE', 'DETOUR'))
  );

  CREATE TABLE IF NOT EXISTS route (
    route_id INTEGER NOT NULL,
    estimated_time REAL,
    number_of_transfers INTEGER DEFAULT 0,
    route_status TEXT,
    reliability_score REAL,
    agency_id INTEGER,
    CONSTRAINT pk_route PRIMARY KEY (route_id AUTOINCREMENT),
    CONSTRAINT fk_route_agency FOREIGN KEY (agency_id) REFERENCES transit_agency (agency_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS vehicle (
    vehicle_id INTEGER NOT NULL,
    vehicle_type TEXT NOT NULL,
    current_location TEXT,
    occupancy_level INTEGER,
    delay_status TEXT,
    route_id INTEGER,
    CONSTRAINT pk_vehicle PRIMARY KEY (vehicle_id AUTOINCREMENT),
    CONSTRAINT fk_vehicle_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS real_time_data (
    data_id INTEGER NOT NULL,
    time REAL NOT NULL,
    vehicle_location TEXT,
    delay_duration REAL,
    schedule_update TEXT,
    vehicle_id INTEGER NOT NULL,
    CONSTRAINT pk_real_time_data PRIMARY KEY (data_id AUTOINCREMENT),
    CONSTRAINT fk_rtd_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle (vehicle_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stop (
    stop_id INTEGER NOT NULL,
    stop_name TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    address TEXT,
    arrival_time REAL,
    time_spent REAL,
    route_id INTEGER,
    CONSTRAINT pk_stop PRIMARY KEY (stop_id AUTOINCREMENT),
    CONSTRAINT fk_stop_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS trip (
    trip_id INTEGER NOT NULL,
    start_location TEXT NOT NULL,
    start_time REAL NOT NULL,
    estimated_travel_time REAL,
    preferred_transit_type TEXT,
    max_transfers INTEGER DEFAULT 0,
    route_id INTEGER,
    stop_id INTEGER,
    user_id INTEGER,
    CONSTRAINT pk_trip PRIMARY KEY (trip_id AUTOINCREMENT),
    CONSTRAINT chk_transit_type CHECK (preferred_transit_type IN ('BUS', 'SUBWAY', 'WALK') OR preferred_transit_type IS NULL),
    CONSTRAINT fk_trip_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE SET NULL,
    CONSTRAINT fk_trip_stop FOREIGN KEY (stop_id) REFERENCES stop (stop_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS user (
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_admin INTEGER NOT NULL DEFAULT 0,
    device_id INTEGER,
    location TEXT,
    notification_preference TEXT,
    trip_id INTEGER,
    CONSTRAINT pk_user PRIMARY KEY (user_id AUTOINCREMENT),
    CONSTRAINT chk_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_is_admin CHECK (is_admin IN (0, 1)),
    CONSTRAINT fk_user_trip FOREIGN KEY (trip_id) REFERENCES trip (trip_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS notification (
    notification_id INTEGER NOT NULL,
    notification_type TEXT,
    message TEXT,
    time TEXT NOT NULL,
    trip_id INTEGER,
    user_id INTEGER,
    CONSTRAINT pk_notification PRIMARY KEY (notification_id AUTOINCREMENT),
    CONSTRAINT fk_notif_trip FOREIGN KEY (trip_id) REFERENCES trip (trip_id) ON DELETE SET NULL,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES user (user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmark (
    bookmark_id INTEGER NOT NULL,
    trip_name TEXT NOT NULL,
    save_date TEXT NOT NULL,
    reminder_time REAL,
    locations_json TEXT,
    user_id INTEGER,
    trip_id INTEGER,
    CONSTRAINT pk_bookmark PRIMARY KEY (bookmark_id AUTOINCREMENT),
    CONSTRAINT fk_bookmark_user FOREIGN KEY (user_id) REFERENCES user (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_bookmark_trip FOREIGN KEY (trip_id) REFERENCES trip (trip_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS location (
    location_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT,
    data_id INTEGER,
    stop_id INTEGER,
    CONSTRAINT pk_location PRIMARY KEY (location_id AUTOINCREMENT),
    CONSTRAINT fk_location_rtd FOREIGN KEY (data_id) REFERENCES real_time_data (data_id) ON DELETE SET NULL,
    CONSTRAINT fk_location_stop FOREIGN KEY (stop_id) REFERENCES stop (stop_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS stop_route (
    stop_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    CONSTRAINT pk_stop_route PRIMARY KEY (stop_id, route_id),
    CONSTRAINT fk_sr_stop FOREIGN KEY (stop_id) REFERENCES stop (stop_id) ON DELETE CASCADE,
    CONSTRAINT fk_sr_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS route_vehicle (
    route_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    CONSTRAINT pk_route_vehicle PRIMARY KEY (route_id, vehicle_id),
    CONSTRAINT fk_rv_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE,
    CONSTRAINT fk_rv_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle (vehicle_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trip_route (
    trip_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    CONSTRAINT pk_trip_route PRIMARY KEY (trip_id, route_id),
    CONSTRAINT fk_tr_trip FOREIGN KEY (trip_id) REFERENCES trip (trip_id) ON DELETE CASCADE,
    CONSTRAINT fk_tr_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trip_stop (
    trip_id INTEGER NOT NULL,
    stop_id INTEGER NOT NULL,
    stop_order INTEGER,
    CONSTRAINT pk_trip_stop PRIMARY KEY (trip_id, stop_id),
    CONSTRAINT fk_ts_trip FOREIGN KEY (trip_id) REFERENCES trip (trip_id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_stop FOREIGN KEY (stop_id) REFERENCES stop (stop_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS alert_route (
    alert_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    CONSTRAINT pk_alert_route PRIMARY KEY (alert_id, route_id),
    CONSTRAINT fk_ar_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_ar_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS alert_stop (
    alert_id INTEGER NOT NULL,
    stop_id INTEGER NOT NULL,
    CONSTRAINT pk_alert_stop PRIMARY KEY (alert_id, stop_id),
    CONSTRAINT fk_as_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_as_stop FOREIGN KEY (stop_id) REFERENCES stop (stop_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmark_trip (
    bookmark_id INTEGER NOT NULL,
    trip_id INTEGER NOT NULL,
    CONSTRAINT pk_bookmark_trip PRIMARY KEY (bookmark_id, trip_id),
    CONSTRAINT fk_bt_bookmark FOREIGN KEY (bookmark_id) REFERENCES bookmark (bookmark_id) ON DELETE CASCADE,
    CONSTRAINT fk_bt_trip FOREIGN KEY (trip_id) REFERENCES trip (trip_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agency_route (
    agency_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    CONSTRAINT pk_agency_route PRIMARY KEY (agency_id, route_id),
    CONSTRAINT fk_agr_agency FOREIGN KEY (agency_id) REFERENCES transit_agency (agency_id) ON DELETE CASCADE,
    CONSTRAINT fk_agr_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_service_alert (
    user_id INTEGER NOT NULL,
    alert_id INTEGER NOT NULL,
    issued_at TEXT NOT NULL,
    CONSTRAINT pk_user_alert PRIMARY KEY (user_id, alert_id),
    CONSTRAINT fk_usa_user FOREIGN KEY (user_id) REFERENCES user (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_usa_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON user (email);
  CREATE INDEX IF NOT EXISTS idx_user_admin ON user (is_admin);
  CREATE INDEX IF NOT EXISTS idx_trip_user ON trip (user_id);
  CREATE INDEX IF NOT EXISTS idx_trip_route ON trip (route_id);
  CREATE INDEX IF NOT EXISTS idx_stop_route ON stop (route_id);
  CREATE INDEX IF NOT EXISTS idx_notification_user ON notification (user_id);
  CREATE INDEX IF NOT EXISTS idx_notification_trip ON notification (trip_id);
  CREATE INDEX IF NOT EXISTS idx_bookmark_user ON bookmark (user_id);
  CREATE INDEX IF NOT EXISTS idx_vehicle_route ON vehicle (route_id);
  CREATE INDEX IF NOT EXISTS idx_rtd_vehicle ON real_time_data (vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_location_stop ON location (stop_id);
  CREATE INDEX IF NOT EXISTS idx_alert_type ON service_alert (alert_type);
`;

describe('Database Schema', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const statements = SCHEMA_SQL.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
    for (const statement of statements) {
      db.exec(statement + ';');
    }
  });

  afterAll(() => {
    db.close();
  });

  it('creates all expected tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('user');
    expect(tableNames).toContain('transit_agency');
    expect(tableNames).toContain('service_alert');
    expect(tableNames).toContain('route');
    expect(tableNames).toContain('vehicle');
    expect(tableNames).toContain('real_time_data');
    expect(tableNames).toContain('stop');
    expect(tableNames).toContain('trip');
    expect(tableNames).toContain('notification');
    expect(tableNames).toContain('bookmark');
    expect(tableNames).toContain('location');
    expect(tableNames).toContain('stop_route');
    expect(tableNames).toContain('route_vehicle');
    expect(tableNames).toContain('trip_route');
    expect(tableNames).toContain('trip_stop');
    expect(tableNames).toContain('alert_route');
    expect(tableNames).toContain('alert_stop');
    expect(tableNames).toContain('bookmark_trip');
    expect(tableNames).toContain('agency_route');
    expect(tableNames).toContain('user_service_alert');
  });

  it('creates all indexes', () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_user_email');
    expect(indexNames).toContain('idx_user_admin');
    expect(indexNames).toContain('idx_trip_user');
    expect(indexNames).toContain('idx_trip_route');
    expect(indexNames).toContain('idx_stop_route');
    expect(indexNames).toContain('idx_notification_user');
    expect(indexNames).toContain('idx_notification_trip');
    expect(indexNames).toContain('idx_bookmark_user');
    expect(indexNames).toContain('idx_vehicle_route');
    expect(indexNames).toContain('idx_rtd_vehicle');
    expect(indexNames).toContain('idx_location_stop');
    expect(indexNames).toContain('idx_alert_type');
  });

  it('allows inserting a user', () => {
    db.prepare(
      'INSERT INTO user (email, password_hash, created_at) VALUES (?, ?, ?)',
    ).run('test@test.com', 'hashed', '2025-01-01');
    const user = db.prepare('SELECT * FROM user WHERE email = ?').get('test@test.com');
    expect(user.email).toBe('test@test.com');
    expect(user.is_active).toBe(1);
    expect(user.is_admin).toBe(0);
  });

  it('enforces unique email constraint', () => {
    expect(() =>
      db.prepare(
        'INSERT INTO user (email, password_hash, created_at) VALUES (?, ?, ?)',
      ).run('test@test.com', 'hashed2', '2025-01-02'),
    ).toThrow();
  });

  it('allows inserting a bookmark with locations_json', () => {
    const locations = JSON.stringify([
      { latitude: 43.65, longitude: -79.38, name: 'Test' },
    ]);
    db.prepare(
      'INSERT INTO bookmark (trip_name, save_date, locations_json, user_id) VALUES (?, ?, ?, ?)',
    ).run('Test Bookmark', '2025-01-01', locations, 1);
    const bookmark = db.prepare('SELECT * FROM bookmark').get();
    expect(bookmark.trip_name).toBe('Test Bookmark');
    expect(JSON.parse(bookmark.locations_json).length).toBe(1);
  });

  it('enforces CHECK constraint on alert_type', () => {
    expect(() =>
      db.prepare(
        "INSERT INTO service_alert (alert_type) VALUES ('INVALID')",
      ).run(),
    ).toThrow();
  });

  it('allows valid alert types', () => {
    db.prepare(
      "INSERT INTO service_alert (alert_type) VALUES ('DELAY')",
    ).run();
    db.prepare(
      "INSERT INTO service_alert (alert_type) VALUES ('CLOSURE')",
    ).run();
    db.prepare(
      "INSERT INTO service_alert (alert_type) VALUES ('DETOUR')",
    ).run();
    const count = db
      .prepare('SELECT COUNT(*) as count FROM service_alert')
      .get() as { count: number };
    expect(count.count).toBe(3);
  });

  it('allows inserting a transit agency', () => {
    db.prepare(
      "INSERT INTO transit_agency (name, region, api_endpoint, update_frequency) VALUES (?, ?, ?, ?)",
    ).run('TTC', 'Toronto', 'https://api.ttc.ca', 30);
    const agency = db.prepare('SELECT * FROM transit_agency').get();
    expect(agency.name).toBe('TTC');
    expect(agency.update_frequency_unit).toBe('MINUTES');
  });

  it('enforces CHECK constraint on update_frequency_unit', () => {
    expect(() =>
      db.prepare(
        "INSERT INTO transit_agency (name, region, api_endpoint, update_frequency, update_frequency_unit) VALUES (?, ?, ?, ?, 'HOURS')",
      ).run('Bad', 'Region', 'url', 1),
    ).toThrow();
  });

  it('allows inserting a route with FK to agency', () => {
    const agencyId = db
      .prepare('SELECT agency_id FROM transit_agency LIMIT 1')
      .get() as { agency_id: number };
    db.prepare(
      'INSERT INTO route (estimated_time, agency_id) VALUES (?, ?)',
    ).run(15.5, agencyId.agency_id);
    const route = db.prepare('SELECT * FROM route').get();
    expect(route.estimated_time).toBe(15.5);
    expect(route.number_of_transfers).toBe(0);
  });

  it('allows inserting a trip with valid transit type', () => {
    db.prepare(
      "INSERT INTO trip (start_location, start_time, preferred_transit_type) VALUES (?, ?, ?)",
    ).run('Downtown', 8.5, 'BUS');
    const trip = db.prepare('SELECT * FROM trip').get();
    expect(trip.preferred_transit_type).toBe('BUS');
  });

  it('rejects invalid transit type', () => {
    expect(() =>
      db.prepare(
        "INSERT INTO trip (start_location, start_time, preferred_transit_type) VALUES (?, ?, ?)",
      ).run('Downtown', 8.5, 'FLY'),
    ).toThrow();
  });

  it('allows inserting a stop with coordinates', () => {
    db.prepare(
      'INSERT INTO stop (stop_name, latitude, longitude) VALUES (?, ?, ?)',
    ).run('Test Stop', 43.6532, -79.3832);
    const stop = db.prepare('SELECT * FROM stop').get();
    expect(stop.stop_name).toBe('Test Stop');
    expect(stop.latitude).toBe(43.6532);
  });

  it('allows inserting a notification', () => {
    db.prepare(
      "INSERT INTO notification (notification_type, message, time, user_id) VALUES (?, ?, ?, ?)",
    ).run('PUSH', 'Test message', '2025-01-01', 1);
    const notif = db.prepare('SELECT * FROM notification').get();
    expect(notif.notification_type).toBe('PUSH');
  });
});
