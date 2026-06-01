-- ============================================================
-- Transit Application Database Schema  (SQLite)
-- ============================================================
--
-- SQLite type affinity used throughout:
--   INTEGER  -> whole numbers (PK with AUTOINCREMENT, counts, IDs)
--   REAL     -> decimals (coordinates, durations, scores)
--   TEXT     -> strings, dates (SQLite has no DATE type; store as
--              ISO-8601 text: 'YYYY-MM-DD' and compare lexically)
--
-- SQLite notes:
--   - Foreign keys are OFF by default, enable per-connection with:
--       PRAGMA foreign_keys = ON;
--   - ALTER TABLE cannot add constraints after creation, so all FKs
--     that would be circular are resolved by reordering table creation.
--   - ON UPDATE CASCADE is not enforced by SQLite; omitted.
--   - BOOLEAN is stored as INTEGER (0 = false, 1 = true).
--   - "user" is not a reserved word in SQLite but is quoted for clarity.
-- ============================================================

PRAGMA foreign_keys = ON;


-- ============================================================
-- ENUM-EQUIVALENT CHECK CONSTRAINTS
-- AlertType:   DELAY | CLOSURE | DETOUR
-- TransitType: BUS | SUBWAY | WALK
-- RoleType:    USER | ADMIN
-- ============================================================


-- ------------------------------------------------------------
-- TABLE: admin
-- Subtype of role. admin_id shares its value with role.role_id.
-- ------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS admin (
--     admin_id          INTEGER  NOT NULL,
--     CONSTRAINT pk_admin PRIMARY KEY (admin_id),
--     CONSTRAINT fk_admin_role
--         FOREIGN KEY (admin_id) REFERENCES role (role_id)
--         ON DELETE CASCADE
-- );
-- doesn't feel that this field is needed?


-- ------------------------------------------------------------
-- TABLE: role
-- Supertype for all principals. Both user and admin rows must
-- have a corresponding role row (Class Table Inheritance).
-- ------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS role (
--     role_id           INTEGER  NOT NULL,
--     role_type         TEXT     NOT NULL,        -- 'USER' | 'ADMIN'
--     email             TEXT     NOT NULL UNIQUE, -- login credential
--     password_hash     TEXT     NOT NULL,        -- bcrypt / argon2 hash
--     created_at        TEXT     NOT NULL,        -- ISO-8601: 'YYYY-MM-DD'
--     is_active         INTEGER  NOT NULL DEFAULT 1, -- 0 = false, 1 = true
--     CONSTRAINT pk_role      PRIMARY KEY (role_id AUTOINCREMENT),
--     CONSTRAINT chk_role_type CHECK (role_type IN ('USER', 'ADMIN'))
-- );
-- this should be combined with user?

-- ------------------------------------------------------------
-- TABLE: user
-- Subtype of role. Regular app user who plans trips, saves
-- bookmarks, and receives notifications.
-- user_id mirrors role.role_id (Class Table Inheritance).
-- ------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS user (
--     user_id                   INTEGER  NOT NULL,
--     device_id                 INTEGER,            -- device identifier
--     location                  TEXT,               -- current location string
--     notification_preference   TEXT,               -- e.g. 'ALL'
--     trip_id                   INTEGER,            -- FK -> trip (active trip)
--     CONSTRAINT pk_user PRIMARY KEY (user_id),
--     CONSTRAINT fk_user_role
--         FOREIGN KEY (user_id) REFERENCES role (role_id)
--         ON DELETE CASCADE,
--     CONSTRAINT fk_user_trip
--         FOREIGN KEY (trip_id) REFERENCES trip (trip_id)
--         ON DELETE SET NULL
-- );

-- Add user_id FK to trip now that user table exists
-- SQLite cannot ALTER TABLE to add FKs; the FK is declared
-- inline above in the trip table definition. The app must
-- insert the user row before inserting trips.

-- ------------------------------------------------------------
-- TABLE: user
-- combined user and role 
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user (
    user_id                   INTEGER  NOT NULL,
    email                     TEXT     NOT NULL UNIQUE, -- login credential
    password_hash             TEXT     NOT NULL,        -- bcrypt / argon2 hash
    created_at                TEXT     NOT NULL,        -- ISO-8601: 'YYYY-MM-DD'
    is_verified               INTEGER  NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
    -- is_active                 INTEGER  NOT NULL DEFAULT 1, -- 0 = false, 1 = true // not needed
    is_admin                  INTEGER  NOT NULL DEFAULT 0, -- 0 = false, 1 = true
    device_id                 INTEGER,                  -- device identifier
    location                  TEXT,                     -- current location string
    notification_preference   TEXT,                     -- e.g. 'ALL'
    trip_id                   INTEGER,                  -- FK -> trip (active trip)
    CONSTRAINT pk_user PRIMARY KEY (user_id AUTOINCREMENT),
    CONSTRAINT chk_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_is_admin  CHECK (is_admin  IN (0, 1)),
    CONSTRAINT fk_user_trip
        FOREIGN KEY (trip_id) REFERENCES trip (trip_id)
        ON DELETE SET NULL
);
-- double check trip_id property


-- ------------------------------------------------------------
-- TABLE: transit_agency
-- A public transit authority that operates routes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transit_agency (
    agency_id              INTEGER  NOT NULL,
    name                   TEXT     NOT NULL,  -- e.g. 'TORONTO TRANSIT COMMISSION'
    region                 TEXT     NOT NULL,  -- e.g. 'YORK'
    api_endpoint           TEXT     NOT NULL,  -- e.g. 'www.ttc/API.ca'
    update_frequency       INTEGER  NOT NULL,  -- numeric value e.g. 30
    update_frequency_unit  TEXT     NOT NULL DEFAULT 'MINUTES',  -- 'MINUTES' | 'SECONDS'
    CONSTRAINT pk_transit_agency PRIMARY KEY (agency_id AUTOINCREMENT),
    CONSTRAINT chk_update_frequency_unit
        CHECK (update_frequency_unit IN ('MINUTES', 'SECONDS'))
);


-- ------------------------------------------------------------
-- TABLE: service_alert
-- Created before route/stop so those tables can FK into it
-- if needed; alerts reference routes/stops via junction tables.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_alert (
    alert_id          INTEGER  NOT NULL,
    alert_type        TEXT     NOT NULL,  -- 'DELAY' | 'CLOSURE' | 'DETOUR'
    description       TEXT,              -- e.g. 'BUS CRASHED'
    start_time        REAL,              -- 24hr clock e.g. 14.5 = 14:30
    end_time          REAL,              -- 24hr clock e.g. 15.0 = 15:00
    severity          INTEGER,           -- severity level 1-5
    CONSTRAINT pk_service_alert PRIMARY KEY (alert_id AUTOINCREMENT),
    CONSTRAINT chk_alert_type
        CHECK (alert_type IN ('DELAY', 'CLOSURE', 'DETOUR'))
);


-- ------------------------------------------------------------
-- TABLE: route
-- A planned transit path operated by an agency.
-- trip_id FK is deferred via junction table to avoid circularity.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route (
    route_id              INTEGER  NOT NULL,
    estimated_time        REAL,              -- estimated length in minutes
    number_of_transfers   INTEGER  DEFAULT 0,
    route_status          TEXT,              -- e.g. 'LINE 1 - CLOSED'
    -- reliability_score     REAL,             -- e.g. 4.9 // wouldn't this be with the bus?
    agency_id             INTEGER,          -- FK -> transit_agency
    CONSTRAINT pk_route PRIMARY KEY (route_id AUTOINCREMENT),
    CONSTRAINT fk_route_agency
        FOREIGN KEY (agency_id) REFERENCES transit_agency (agency_id)
        ON DELETE SET NULL
);


-- ------------------------------------------------------------
-- TABLE: vehicle
-- A transit vehicle assigned to a route.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle (
    vehicle_id        INTEGER  NOT NULL,
    vehicle_type      TEXT     NOT NULL,  -- e.g. 'BUS'
    current_location  TEXT,              -- e.g. 'SENECA HILL DRIVE'
    -- occupancy_level   INTEGER,           -- number of occupants  // don't need to store maybe
    -- delay_status      TEXT,              -- e.g. 'LINE 1 - CLOSED' // don't need to store
    route_id          INTEGER,           -- FK -> route
    CONSTRAINT pk_vehicle PRIMARY KEY (vehicle_id AUTOINCREMENT),
    CONSTRAINT fk_vehicle_route
        FOREIGN KEY (route_id) REFERENCES route (route_id)
        ON DELETE SET NULL
);


-- ------------------------------------------------------------
-- TABLE: real_time_data
-- Live telemetry record for a vehicle.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS real_time_data (
    data_id           INTEGER  NOT NULL,
    time              REAL     NOT NULL,  -- 24hr clock e.g. 14.5 = 14:30
    vehicle_location  TEXT,              -- 'lat,lng' stored as text pair
    delay_duration    REAL,              -- duration in minutes
    schedule_update   TEXT,              -- e.g. 'TRAIN LEAVING IN 5 MINUTES'
    vehicle_id        INTEGER  NOT NULL, -- FK -> vehicle
    CONSTRAINT pk_real_time_data PRIMARY KEY (data_id AUTOINCREMENT),
    CONSTRAINT fk_rtd_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle (vehicle_id)
        ON DELETE CASCADE
);


-- ------------------------------------------------------------
-- TABLE: stop
-- A physical transit stop. References route and trip;
-- trip FK placed here to avoid forward-reference, trip is
-- created next and stop.trip_id left nullable.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stop (
    stop_id           INTEGER  NOT NULL,
    stop_name         TEXT     NOT NULL,  -- e.g. 'SENECA HILL DRIVE'
    latitude          REAL,              -- decimal degrees
    longitude         REAL,              -- decimal degrees
    address           TEXT,
    arrival_time      REAL,              -- 24hr clock e.g. 14.5 = 14:30
    time_spent        REAL,              -- minutes spent at stop
    route_id          INTEGER,           -- FK -> route (primary route)
    CONSTRAINT pk_stop PRIMARY KEY (stop_id AUTOINCREMENT),
    CONSTRAINT fk_stop_route
        FOREIGN KEY (route_id) REFERENCES route (route_id)
        ON DELETE SET NULL
);


-- ------------------------------------------------------------
-- TABLE: trip
-- A planned journey. References user and stop; user FK added
-- after user table. stop_id is the trip's primary/first stop.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip (
    trip_id                   INTEGER  NOT NULL,
    start_location            TEXT     NOT NULL,  -- e.g. 'SENECA HILL DRIVE'
    start_time                REAL     NOT NULL,  -- 24hr clock e.g. 14.5 = 14:30
    estimated_travel_time     REAL,               -- minutes
    preferred_transit_type    TEXT,               -- 'BUS' | 'SUBWAY' | 'WALK'
    max_transfers             INTEGER  DEFAULT 0,
    route_id                  INTEGER,            -- FK -> route
    stop_id                   INTEGER,            -- FK -> stop (primary stop)
    user_id                   INTEGER,            -- FK -> user (set after user table)
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


-- ------------------------------------------------------------
-- TABLE: notification
-- A push/in-app alert sent to a user about a trip.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification (
    notification_id     INTEGER  NOT NULL,
    notification_type   TEXT,               -- e.g. 'PUSH'
    message             TEXT,               -- e.g. 'Vehicle arriving now'
    time                TEXT     NOT NULL,  -- ISO-8601 date: 'YYYY-MM-DD'
    trip_id             INTEGER,            -- FK -> trip
    user_id             INTEGER,            -- FK -> user
    CONSTRAINT pk_notification PRIMARY KEY (notification_id AUTOINCREMENT),
    CONSTRAINT fk_notif_trip
        FOREIGN KEY (trip_id) REFERENCES trip (trip_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_notif_user
        FOREIGN KEY (user_id) REFERENCES user (user_id)
        ON DELETE CASCADE
);


-- ------------------------------------------------------------
-- TABLE: bookmark
-- A named, saved trip with an optional reminder.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookmark (
    bookmark_id       INTEGER  NOT NULL,
    trip_name         TEXT     NOT NULL,  -- e.g. 'TRIP ONE'
    save_date         TEXT     NOT NULL,  -- ISO-8601: 'YYYY-MM-DD'
    reminder_time     REAL,              -- 24hr clock e.g. 8.5 = 08:30
    user_id           INTEGER,           -- FK -> user
    trip_id           INTEGER,           -- FK -> trip (primary saved trip)
    CONSTRAINT pk_bookmark PRIMARY KEY (bookmark_id AUTOINCREMENT),
    CONSTRAINT fk_bookmark_user
        FOREIGN KEY (user_id) REFERENCES user (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_bookmark_trip
        FOREIGN KEY (trip_id) REFERENCES trip (trip_id)
        ON DELETE SET NULL
);


-- ------------------------------------------------------------
-- TABLE: location
-- GPS/address capture linked to a stop or real-time record.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location (
    location_id       INTEGER  NOT NULL,
    latitude          REAL     NOT NULL,
    longitude         REAL     NOT NULL,
    address           TEXT,
    data_id           INTEGER,            -- FK -> real_time_data
    stop_id           INTEGER,            -- FK -> stop
    CONSTRAINT pk_location PRIMARY KEY (location_id AUTOINCREMENT),
    CONSTRAINT fk_location_rtd
        FOREIGN KEY (data_id) REFERENCES real_time_data (data_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_location_stop
        FOREIGN KEY (stop_id) REFERENCES stop (stop_id)
        ON DELETE SET NULL
);


-- ============================================================
-- JUNCTION / ASSOCIATION TABLES  (many-to-many relationships)
-- ============================================================

-- Stop <-> Route  ("is part of")
CREATE TABLE IF NOT EXISTS stop_route (
    stop_id           INTEGER NOT NULL,
    route_id          INTEGER NOT NULL,
    CONSTRAINT pk_stop_route PRIMARY KEY (stop_id, route_id),
    CONSTRAINT fk_sr_stop  FOREIGN KEY (stop_id)  REFERENCES stop  (stop_id)  ON DELETE CASCADE,
    CONSTRAINT fk_sr_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
);

-- Route <-> Vehicle  ("can use")
CREATE TABLE IF NOT EXISTS route_vehicle (
    route_id          INTEGER NOT NULL,
    vehicle_id        INTEGER NOT NULL,
    CONSTRAINT pk_route_vehicle PRIMARY KEY (route_id, vehicle_id),
    CONSTRAINT fk_rv_route   FOREIGN KEY (route_id)   REFERENCES route   (route_id)   ON DELETE CASCADE,
    CONSTRAINT fk_rv_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle (vehicle_id) ON DELETE CASCADE
);

-- Trip <-> Route  ("can use")
CREATE TABLE IF NOT EXISTS trip_route (
    trip_id           INTEGER NOT NULL,
    route_id          INTEGER NOT NULL,
    CONSTRAINT pk_trip_route PRIMARY KEY (trip_id, route_id),
    CONSTRAINT fk_tr_trip  FOREIGN KEY (trip_id)  REFERENCES trip  (trip_id)  ON DELETE CASCADE,
    CONSTRAINT fk_tr_route FOREIGN KEY (route_id) REFERENCES route (route_id) ON DELETE CASCADE
);

-- Trip <-> Stop  ("contains")
CREATE TABLE IF NOT EXISTS trip_stop (
    trip_id           INTEGER NOT NULL,
    stop_id           INTEGER NOT NULL,
    stop_order        INTEGER,           -- sequence of stop within trip
    CONSTRAINT pk_trip_stop PRIMARY KEY (trip_id, stop_id),
    CONSTRAINT fk_ts_trip FOREIGN KEY (trip_id) REFERENCES trip (trip_id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_stop FOREIGN KEY (stop_id) REFERENCES stop (stop_id) ON DELETE CASCADE
);

-- ServiceAlert <-> Route  ("affects / targets")
CREATE TABLE IF NOT EXISTS alert_route (
    alert_id          INTEGER NOT NULL,
    route_id          INTEGER NOT NULL,
    CONSTRAINT pk_alert_route PRIMARY KEY (alert_id, route_id),
    CONSTRAINT fk_ar_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_ar_route FOREIGN KEY (route_id) REFERENCES route         (route_id) ON DELETE CASCADE
);

-- ServiceAlert <-> Stop  ("affects")
CREATE TABLE IF NOT EXISTS alert_stop (
    alert_id          INTEGER NOT NULL,
    stop_id           INTEGER NOT NULL,
    CONSTRAINT pk_alert_stop PRIMARY KEY (alert_id, stop_id),
    CONSTRAINT fk_as_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_as_stop  FOREIGN KEY (stop_id)  REFERENCES stop          (stop_id)  ON DELETE CASCADE
);

-- Bookmark <-> Trip  ("saves / tripSet")
CREATE TABLE IF NOT EXISTS bookmark_trip (
    bookmark_id       INTEGER NOT NULL,
    trip_id           INTEGER NOT NULL,
    CONSTRAINT pk_bookmark_trip PRIMARY KEY (bookmark_id, trip_id),
    CONSTRAINT fk_bt_bookmark FOREIGN KEY (bookmark_id) REFERENCES bookmark (bookmark_id) ON DELETE CASCADE,
    CONSTRAINT fk_bt_trip     FOREIGN KEY (trip_id)     REFERENCES trip     (trip_id)     ON DELETE CASCADE
);

-- TransitAgency <-> Route  ("holds")
CREATE TABLE IF NOT EXISTS agency_route (
    agency_id         INTEGER NOT NULL,
    route_id          INTEGER NOT NULL,
    CONSTRAINT pk_agency_route PRIMARY KEY (agency_id, route_id),
    CONSTRAINT fk_agr_agency FOREIGN KEY (agency_id) REFERENCES transit_agency (agency_id) ON DELETE CASCADE,
    CONSTRAINT fk_agr_route  FOREIGN KEY (route_id)  REFERENCES route          (route_id)  ON DELETE CASCADE
);

-- Admin <-> ServiceAlert  ("issued by")
CREATE TABLE IF NOT EXISTS admin_service_alert (
    admin_id          INTEGER NOT NULL,
    alert_id          INTEGER NOT NULL,
    issued_at         TEXT    NOT NULL,  -- ISO-8601: 'YYYY-MM-DD'
    CONSTRAINT pk_admin_alert PRIMARY KEY (admin_id, alert_id),
    CONSTRAINT fk_asa_admin FOREIGN KEY (admin_id) REFERENCES admin         (admin_id) ON DELETE CASCADE,
    CONSTRAINT fk_asa_alert FOREIGN KEY (alert_id) REFERENCES service_alert (alert_id) ON DELETE CASCADE
);


-- ============================================================
-- INDEXES  (commonly queried FK and lookup columns)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_trip_user         ON trip           (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_route        ON trip           (route_id);
CREATE INDEX IF NOT EXISTS idx_stop_route        ON stop           (route_id);
CREATE INDEX IF NOT EXISTS idx_notification_user ON notification   (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_trip ON notification   (trip_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_user     ON bookmark       (user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_route     ON vehicle        (route_id);
CREATE INDEX IF NOT EXISTS idx_rtd_vehicle       ON real_time_data (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_location_stop     ON location       (stop_id);
CREATE INDEX IF NOT EXISTS idx_alert_type        ON service_alert  (alert_type);
-- Role / Auth (commented out since role table was merged into user)
-- CREATE INDEX IF NOT EXISTS idx_role_type         ON role           (role_type);
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_role_email ON role           (email);