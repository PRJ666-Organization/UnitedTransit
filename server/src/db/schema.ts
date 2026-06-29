export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS transit_agency (
    agency_id             INTEGER  NOT NULL,
    name                  TEXT     NOT NULL,
    region                TEXT     NOT NULL,
    api_endpoint          TEXT     NOT NULL,
    update_frequency      INTEGER  NOT NULL,
    update_frequency_unit TEXT     NOT NULL DEFAULT 'MINUTES',
    CONSTRAINT pk_transit_agency PRIMARY KEY (agency_id AUTOINCREMENT),
    CONSTRAINT chk_update_frequency_unit
        CHECK (update_frequency_unit IN ('MINUTES', 'SECONDS'))
  );

  CREATE TABLE IF NOT EXISTS service_alert (
    alert_id    INTEGER NOT NULL,
    alert_type  TEXT    NOT NULL,
    description TEXT,
    start_time  REAL,
    end_time    REAL,
    severity    INTEGER,
    CONSTRAINT pk_service_alert PRIMARY KEY (alert_id AUTOINCREMENT),
    CONSTRAINT chk_alert_type CHECK (alert_type IN ('DELAY', 'CLOSURE', 'DETOUR'))
  );

  CREATE TABLE IF NOT EXISTS route (
    route_id            INTEGER NOT NULL,
    estimated_time      REAL,
    number_of_transfers INTEGER DEFAULT 0,
    route_status        TEXT,
    reliability_score   REAL,
    agency_id           INTEGER,
    CONSTRAINT pk_route PRIMARY KEY (route_id AUTOINCREMENT),
    CONSTRAINT fk_route_agency
        FOREIGN KEY (agency_id) REFERENCES transit_agency (agency_id)
        ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS vehicle (
    vehicle_id       INTEGER NOT NULL,
    vehicle_type     TEXT    NOT NULL,
    current_location TEXT,
    occupancy_level  INTEGER,
    delay_status     TEXT,
    route_id         INTEGER,
    CONSTRAINT pk_vehicle PRIMARY KEY (vehicle_id AUTOINCREMENT),
    CONSTRAINT fk_vehicle_route
        FOREIGN KEY (route_id) REFERENCES route (route_id)
        ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS real_time_data (
    data_id          INTEGER NOT NULL,
    time             REAL    NOT NULL,
    vehicle_location TEXT,
    delay_duration   REAL,
    schedule_update  TEXT,
    vehicle_id       INTEGER NOT NULL,
    CONSTRAINT pk_real_time_data PRIMARY KEY (data_id AUTOINCREMENT),
    CONSTRAINT fk_rtd_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle (vehicle_id)
        ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stop (
    stop_id      INTEGER NOT NULL,
    stop_name    TEXT    NOT NULL,
    latitude     REAL,
    longitude    REAL,
    address      TEXT,
    arrival_time REAL,
    time_spent   REAL,
    route_id     INTEGER,
    CONSTRAINT pk_stop PRIMARY KEY (stop_id AUTOINCREMENT),
    CONSTRAINT fk_stop_route
        FOREIGN KEY (route_id) REFERENCES route (route_id)
        ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS trip (
    trip_id                INTEGER NOT NULL,
    start_location         TEXT    NOT NULL,
    start_time             REAL    NOT NULL,
    estimated_travel_time  REAL,
    preferred_transit_type TEXT,
    max_transfers          INTEGER DEFAULT 0,
    route_id               INTEGER,
    stop_id                INTEGER,
    user_id                INTEGER,
    CONSTRAINT pk_trip PRIMARY KEY (trip_id AUTOINCREMENT),
    CONSTRAINT chk_transit_type
        CHECK (preferred_transit_type IN ('BUS', 'SUBWAY', 'WALK', NULL)),
    CONSTRAINT fk_trip_route
        FOREIGN KEY (route_id) REFERENCES route (route_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_trip_stop
        FOREIGN KEY (stop_id) REFERENCES stop (stop_id)
        ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS user (
    user_id                 INTEGER NOT NULL,
    email                   TEXT    NOT NULL UNIQUE,
    password_hash           TEXT    NOT NULL,
    created_at              TEXT    NOT NULL,
    is_active               INTEGER NOT NULL DEFAULT 1,
    is_admin                INTEGER NOT NULL DEFAULT 0,
    is_verified             INTEGER NOT NULL DEFAULT 0,
    device_id               INTEGER,
    location                TEXT,
    notification_preference TEXT,
    trip_id                 INTEGER,
    CONSTRAINT pk_user PRIMARY KEY (user_id AUTOINCREMENT),
    CONSTRAINT chk_is_active   CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_is_admin    CHECK (is_admin  IN (0, 1)),
    CONSTRAINT chk_is_verified CHECK (is_verified  IN (0, 1)),
    CONSTRAINT fk_user_trip
        FOREIGN KEY (trip_id) REFERENCES trip (trip_id)
        ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS notification (
    notification_id   INTEGER NOT NULL,
    notification_type TEXT,
    message           TEXT,
    time              TEXT    NOT NULL,
    trip_id           INTEGER,
    user_id           INTEGER,
    CONSTRAINT pk_notification PRIMARY KEY (notification_id AUTOINCREMENT),
    CONSTRAINT fk_notif_trip
        FOREIGN KEY (trip_id) REFERENCES trip (trip_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_notif_user
        FOREIGN KEY (user_id) REFERENCES user (user_id)
        ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmark (
    bookmark_id   INTEGER NOT NULL,
    trip_name     TEXT    NOT NULL,
    save_date     TEXT    NOT NULL,
    reminder_time REAL,
    locations_json TEXT,
    user_id       INTEGER,
    trip_id       INTEGER,
    CONSTRAINT pk_bookmark PRIMARY KEY (bookmark_id AUTOINCREMENT),
    CONSTRAINT fk_bookmark_user
        FOREIGN KEY (user_id) REFERENCES user (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_bookmark_trip
        FOREIGN KEY (trip_id) REFERENCES trip (trip_id)
        ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS location (
    location_id INTEGER NOT NULL,
    latitude    REAL    NOT NULL,
    longitude   REAL    NOT NULL,
    address     TEXT,
    data_id     INTEGER,
    stop_id     INTEGER,
    CONSTRAINT pk_location PRIMARY KEY (location_id AUTOINCREMENT),
    CONSTRAINT fk_location_rtd
        FOREIGN KEY (data_id) REFERENCES real_time_data (data_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_location_stop
        FOREIGN KEY (stop_id) REFERENCES stop (stop_id)
        ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS stop_route (
    stop_id  INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    CONSTRAINT pk_stop_route PRIMARY KEY (stop_id, route_id),
    CONSTRAINT fk_sr_stop  FOREIGN KEY (stop_id)  REFERENCES stop  (stop_id)  ON DELETE CASCADE,
    CONSTRAINT fk_sr_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS route_vehicle (
    route_id   INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    CONSTRAINT pk_route_vehicle PRIMARY KEY (route_id, vehicle_id),
    CONSTRAINT fk_rv_route   FOREIGN KEY (route_id)   REFERENCES route    (route_id)   ON DELETE CASCADE,
    CONSTRAINT fk_rv_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle  (vehicle_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trip_route (
    trip_id  INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    CONSTRAINT pk_trip_route PRIMARY KEY (trip_id, route_id),
    CONSTRAINT fk_tr_trip  FOREIGN KEY (trip_id)  REFERENCES trip  (trip_id)  ON DELETE CASCADE,
    CONSTRAINT fk_tr_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trip_stop (
    trip_id    INTEGER NOT NULL,
    stop_id    INTEGER NOT NULL,
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
    CONSTRAINT fk_ar_route FOREIGN KEY (route_id) REFERENCES route         (route_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS alert_stop (
    alert_id INTEGER NOT NULL,
    stop_id  INTEGER NOT NULL,
    CONSTRAINT pk_alert_stop PRIMARY KEY (alert_id, stop_id),
    CONSTRAINT fk_as_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_as_stop  FOREIGN KEY (stop_id)  REFERENCES stop          (stop_id)  ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmark_trip (
    bookmark_id INTEGER NOT NULL,
    trip_id     INTEGER NOT NULL,
    CONSTRAINT pk_bookmark_trip PRIMARY KEY (bookmark_id, trip_id),
    CONSTRAINT fk_bt_bookmark FOREIGN KEY (bookmark_id) REFERENCES bookmark (bookmark_id) ON DELETE CASCADE,
    CONSTRAINT fk_bt_trip     FOREIGN KEY (trip_id)     REFERENCES trip     (trip_id)     ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agency_route (
    agency_id INTEGER NOT NULL,
    route_id  INTEGER NOT NULL,
    CONSTRAINT pk_agency_route PRIMARY KEY (agency_id, route_id),
    CONSTRAINT fk_agr_agency FOREIGN KEY (agency_id) REFERENCES transit_agency (agency_id) ON DELETE CASCADE,
    CONSTRAINT fk_agr_route  FOREIGN KEY (route_id)  REFERENCES route           (route_id)  ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_service_alert (
    user_id   INTEGER NOT NULL,
    alert_id  INTEGER NOT NULL,
    issued_at TEXT    NOT NULL,
    CONSTRAINT pk_user_alert PRIMARY KEY (user_id, alert_id),
    CONSTRAINT fk_usa_user  FOREIGN KEY (user_id)  REFERENCES user          (user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_usa_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gtfs_stops (
    stop_id TEXT PRIMARY KEY,
    stop_code TEXT,
    stop_name TEXT NOT NULL,
    stop_desc TEXT,
    stop_lat REAL NOT NULL,
    stop_lon REAL NOT NULL,
    zone_id TEXT,
    stop_url TEXT,
    location_type INTEGER,
    parent_station TEXT,
    stop_timezone TEXT,
    wheelchair_boarding INTEGER,
    level_id TEXT
  );

  CREATE TABLE IF NOT EXISTS gtfs_routes (
    route_id TEXT PRIMARY KEY,
    agency_id TEXT,
    route_short_name TEXT,
    route_long_name TEXT,
    route_type INTEGER,
    route_color TEXT,
    route_text_color TEXT
  );

  CREATE TABLE IF NOT EXISTS gtfs_trips (
    trip_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    trip_headsign TEXT,
    trip_short_name TEXT,
    direction_id INTEGER,
    block_id TEXT,
    shape_id TEXT,
    wheelchair_accessible INTEGER,

    FOREIGN KEY (route_id)
        REFERENCES gtfs_routes(route_id)
  );

  CREATE TABLE IF NOT EXISTS gtfs_stop_times (
    trip_id TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    stop_sequence INTEGER NOT NULL,
    stop_headsign TEXT,
    pickup_type INTEGER,
    drop_off_type INTEGER,
    shape_dist_traveled REAL,
    timepoint INTEGER,

    PRIMARY KEY (trip_id, stop_sequence),

    FOREIGN KEY (trip_id)
        REFERENCES gtfs_trips(trip_id),

    FOREIGN KEY (stop_id)
        REFERENCES gtfs_stops(stop_id)
  );

  CREATE TABLE IF NOT EXISTS gtfs_shapes (
    shape_id TEXT NOT NULL,
    shape_pt_lat REAL NOT NULL,
    shape_pt_lon REAL NOT NULL,
    shape_pt_sequence INTEGER NOT NULL,
    shape_dist_traveled REAL,

    PRIMARY KEY (shape_id, shape_pt_sequence)
  );

  CREATE TABLE IF NOT EXISTS verification_token (
    token      TEXT    NOT NULL,
    user_id    INTEGER NOT NULL,
    created_at TEXT    NOT NULL,
    CONSTRAINT pk_verification_token PRIMARY KEY (token),
    CONSTRAINT fk_vt_user FOREIGN KEY (user_id) REFERENCES user (user_id) ON DELETE CASCADE
  );

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

  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON user (email);
  CREATE INDEX IF NOT EXISTS idx_user_admin        ON user (is_admin);
  CREATE INDEX IF NOT EXISTS idx_trip_user         ON trip (user_id);
  CREATE INDEX IF NOT EXISTS idx_trip_route        ON trip (route_id);
  CREATE INDEX IF NOT EXISTS idx_stop_route        ON stop (route_id);
  CREATE INDEX IF NOT EXISTS idx_notification_user ON notification   (user_id);
  CREATE INDEX IF NOT EXISTS idx_notification_trip ON notification   (trip_id);
  CREATE INDEX IF NOT EXISTS idx_bookmark_user     ON bookmark       (user_id);
  CREATE INDEX IF NOT EXISTS idx_vehicle_route     ON vehicle        (route_id);
  CREATE INDEX IF NOT EXISTS idx_rtd_vehicle       ON real_time_data (vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_location_stop     ON location       (stop_id);
  CREATE INDEX IF NOT EXISTS idx_alert_type        ON service_alert  (alert_type);
  CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_stop ON gtfs_stop_times(stop_id);
  CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_trip ON gtfs_stop_times(trip_id);
  CREATE INDEX IF NOT EXISTS idx_gtfs_trips_route ON gtfs_trips(route_id);
  CREATE INDEX IF NOT EXISTS idx_gtfs_shapes_shape ON gtfs_shapes(shape_id);
  CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history (user_id);
  CREATE INDEX IF NOT EXISTS idx_search_history_device ON search_history (device_id);

  -- Active trip session tracking
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

  -- Location tracking log
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

  -- Delay events
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

  CREATE INDEX IF NOT EXISTS idx_trip_location_session ON trip_location_update(session_id);
  CREATE INDEX IF NOT EXISTS idx_trip_location_time ON trip_location_update(timestamp);
  CREATE INDEX IF NOT EXISTS idx_delay_event_session ON trip_delay_event(session_id);
  CREATE INDEX IF NOT EXISTS idx_delay_event_time ON trip_delay_event(created_at);
`;
