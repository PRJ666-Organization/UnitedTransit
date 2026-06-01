import express from 'express';
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

export default router;
