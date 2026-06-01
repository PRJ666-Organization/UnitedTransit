import express from 'express';
import { getVehiclesByRoute, getVehiclesByTrip } from '../services/nvasService';
import { runQuery } from '../db/database';

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
       ORDER BY route_short_name`
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
      [shortName, `%${shortName}%`]
    );
    res.json(routes[0] || null);
  } catch (err) {
    console.error('[Live] Failed to fetch route info:', err);
    res.status(500).json({ error: 'Failed to fetch route info' });
  }
});

export default router;
