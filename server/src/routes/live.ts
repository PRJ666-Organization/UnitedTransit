import express from 'express';
import { runQuery } from '../db/database';
import { getVehiclesByRoute, getVehiclesByTrip } from '../services/nvasService';

const router = express.Router();

// GET /api/live/route/36
router.get('/route/:routeId', async (req, res) => {
  try {
    const data = await getVehiclesByRoute(req.params.routeId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch route vehicles' });
  }
});

// GET /api/live/trip/:tripId
router.get('/trip/:tripId', async (req, res) => {
  try {
    const data = await getVehiclesByTrip(req.params.tripId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trip vehicles' });
  }
});

// GET /api/live/routes - Get all routes from GTFS
router.get('/routes', async (req, res) => {
  try {
    const routes = await runQuery(
      `SELECT route_id, route_short_name, route_long_name, route_type, route_color
       FROM gtfs_routes
       ORDER BY route_short_name`,
    );
    res.json(routes);
  } catch (err) {
    console.error('[Live] Failed to fetch routes:', err);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// GET /api/live/route-info/:shortName - Get route info by short name
router.get('/route-info/:shortName', async (req, res) => {
  try {
    const { shortName } = req.params;
    const routes = await runQuery(
      `SELECT route_id, route_short_name, route_long_name, route_type, route_color
       FROM gtfs_routes
       WHERE route_short_name = ? OR route_long_name LIKE ?`,
      [shortName, `%${shortName}%`],
    );
    res.json(routes[0] || null);
  } catch (err) {
    console.error('[Live] Failed to fetch route info:', err);
    res.status(500).json({ error: 'Failed to fetch route info' });
  }
});

function toRad(x: number) {
  return (x * Math.PI) / 180;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =====================================================
// ROUTE
// =====================================================

router.get('/stop/:stopId/route/:routeId', async (req, res) => {
  try {
    const { stopId, routeId } = req.params;
    const now = new Date();

    // =====================================================
    // 1. GET LIVE VEHICLES
    // =====================================================
    const vehicles = await getVehiclesByRoute(routeId);

    if (!vehicles?.length) {
      return res.json({
        stopId,
        routeId,
        currentTime: now.toISOString(),
        arrivals: [],
      });
    }

    // =====================================================
    // 2. NORMALIZE
    // =====================================================
    const normalized = vehicles.map((v) => ({
      vehicleId: v.vehicleId,
      tripId: v.tripId,
      routeId: String(v.routeId),
      lat: v.lat ?? v.latitude,
      lon: v.lon ?? v.longitude,
      speed: v.speed,
      bearing: v.bearing,
    }));

    // =====================================================
    // 3. FILTER VALID VEHICLES
    // =====================================================
    const active = normalized.filter((v) => v.lat != null && v.lon != null && v.tripId);

    // =====================================================
    // 4. GET STOP COORDS (TEMP HARDCODE OR DB LATER)
    // =====================================================
    const STOP_LAT = 43.7739;
    const STOP_LON = -79.4423;

    // =====================================================
    // 5. COMPUTE DISTANCE ONLY (NO ETA)
    // =====================================================
    const enriched = active.map((v) => {
      const dist = distanceMeters(v.lat, v.lon, STOP_LAT, STOP_LON);

      return {
        ...v,
        distance: dist,
      };
    });

    // =====================================================
    // 6. SORT BY DISTANCE (PROXIMITY = "STOPS AWAY" APPROX)
    // =====================================================
    const sorted = enriched.sort((a, b) => a.distance - b.distance);

    // =====================================================
    // 7. MAP TO "STOPS AWAY"
    // =====================================================
    const arrivals = sorted.slice(0, 3).map((v, index) => {
      // VERY ROUGH conversion:
      // assume ~350m per stop average TTC spacing
      const stopsAway = Math.max(1, Math.round(v.distance / 350));

      return {
        tripId: v.tripId,

        status: 'LIVE',

        stopsAway,

        distanceMeters: Math.round(v.distance),

        hasLiveVehicle: true,

        vehicle: {
          vehicleId: v.vehicleId,
          routeId: v.routeId,
          tripId: v.tripId,
          latitude: v.lat,
          longitude: v.lon,
          bearing: v.bearing,
        },
      };
    });

    // =====================================================
    // 8. RESPONSE
    // =====================================================
    res.json({
      stopId,
      routeId,
      currentTime: now.toISOString(),
      arrivals,
    });
  } catch (err) {
    console.error('[LIVE STOP ROUTE ERROR]', err);
    res.status(500).json({
      error: 'failed to compute stops-away view',
    });
  }
});

export default router;
