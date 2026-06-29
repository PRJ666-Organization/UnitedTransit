import { Router } from 'express';
import { runQuery, runMutation } from '../db/database';

const router = Router();

/**
 * POST /api/trip-session/start
 * Start a new active trip session
 *
 * Body: { userId?: number, deviceId?: string, locations: BookmarkLocation[], selectedRoutes: Record<number, number> }
 */
router.post('/start', async (req, res) => {
  try {
    const { userId, deviceId, locations, selectedRoutes } = req.body;

    if (!locations || locations.length < 2) {
      return res.status(400).json({ error: 'At least 2 locations required' });
    }

    const now = new Date().toISOString();

    // Create trip record
    const tripResult = await runMutation(
      `INSERT INTO trip (start_location, start_time, estimated_travel_time, user_id)
       VALUES (?, ?, ?, ?)`,
      [JSON.stringify(locations[0]), now, 0, userId || null]
    );

    const tripId = tripResult.lastInsertRowId;

    // Create active session
    const sessionResult = await runMutation(
      `INSERT INTO active_trip_session
       (user_id, device_id, trip_id, started_at, last_updated, locations_json, selected_routes_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        userId || null,
        deviceId || null,
        tripId,
        now,
        now,
        JSON.stringify(locations),
        JSON.stringify(selectedRoutes || {})
      ]
    );

    res.json({
      sessionId: sessionResult.lastInsertRowId,
      tripId,
      status: 'active',
      startedAt: now
    });
  } catch (err) {
    console.error('[TripSession] Start error:', err);
    res.status(500).json({ error: 'Failed to start trip session' });
  }
});

/**
 * GET /api/trip-session/:sessionId
 * Get current session status
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    const sessions = await runQuery(
      `SELECT * FROM active_trip_session WHERE session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[0] as any;

    // Parse JSON fields
    res.json({
      ...session,
      locations_json: JSON.parse(session.locations_json || '[]'),
      selected_routes_json: JSON.parse(session.selected_routes_json || '{}')
    });
  } catch (err) {
    console.error('[TripSession] Get error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * PUT /api/trip-session/:sessionId/update-location
 * Update user's current location
 *
 * Body: { latitude: number, longitude: number, accuracy?: number, etaMinutes?: number, distanceToNextStop?: number }
 */
router.put('/:sessionId/update-location', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { latitude, longitude, accuracy, etaMinutes, distanceToNextStop } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const now = new Date().toISOString();

    // Insert location update
    await runMutation(
      `INSERT INTO trip_location_update
       (session_id, latitude, longitude, accuracy, timestamp, eta_minutes, distance_to_next_stop)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, latitude, longitude, accuracy || null, now, etaMinutes || null, distanceToNextStop || null]
    );

    // Update session last_updated
    await runMutation(
      `UPDATE active_trip_session SET last_updated = ? WHERE session_id = ?`,
      [now, sessionId]
    );

    res.json({ success: true, timestamp: now });
  } catch (err) {
    console.error('[TripSession] Update location error:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * PUT /api/trip-session/:sessionId/adjust
 * Adjust trip (add/remove stops, switch modes)
 *
 * Body: { locations: BookmarkLocation[], selectedRoutes: Record<number, number>, currentSegment?: number }
 */
router.put('/:sessionId/adjust', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { locations, selectedRoutes, currentSegment } = req.body;

    if (!locations || !selectedRoutes) {
      return res.status(400).json({ error: 'Locations and selectedRoutes required' });
    }

    const now = new Date().toISOString();

    await runMutation(
      `UPDATE active_trip_session
       SET locations_json = ?, selected_routes_json = ?, current_segment = ?, last_updated = ?
       WHERE session_id = ?`,
      [
        JSON.stringify(locations),
        JSON.stringify(selectedRoutes),
        currentSegment !== undefined ? currentSegment : 0,
        now,
        sessionId
      ]
    );

    // Clear old delay events for this session
    await runMutation(
      `DELETE FROM trip_delay_event WHERE session_id = ? AND resolved_at IS NULL`,
      [sessionId]
    );

    res.json({ success: true, lastUpdated: now });
  } catch (err) {
    console.error('[TripSession] Adjust error:', err);
    res.status(500).json({ error: 'Failed to adjust trip' });
  }
});

/**
 * PUT /api/trip-session/:sessionId/progress
 * Update current segment/stop progress
 *
 * Body: { currentSegment?: number, currentStopIndex?: number }
 */
router.put('/:sessionId/progress', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { currentSegment, currentStopIndex } = req.body;

    const now = new Date().toISOString();

    const updates: string[] = [];
    const params: any[] = [];

    if (currentSegment !== undefined) {
      updates.push('current_segment = ?');
      params.push(currentSegment);
    }
    if (currentStopIndex !== undefined) {
      updates.push('current_stop_index = ?');
      params.push(currentStopIndex);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('last_updated = ?');
    params.push(now);
    params.push(sessionId);

    await runMutation(
      `UPDATE active_trip_session SET ${updates.join(', ')} WHERE session_id = ?`,
      params
    );

    res.json({ success: true, lastUpdated: now });
  } catch (err) {
    console.error('[TripSession] Progress error:', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

/**
 * POST /api/trip-session/:sessionId/pause
 * Pause active trip
 */
router.post('/:sessionId/pause', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const now = new Date().toISOString();

    await runMutation(
      `UPDATE active_trip_session SET status = 'paused', last_updated = ? WHERE session_id = ?`,
      [now, sessionId]
    );

    res.json({ success: true, status: 'paused', lastUpdated: now });
  } catch (err) {
    console.error('[TripSession] Pause error:', err);
    res.status(500).json({ error: 'Failed to pause trip' });
  }
});

/**
 * POST /api/trip-session/:sessionId/resume
 * Resume paused trip
 */
router.post('/:sessionId/resume', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const now = new Date().toISOString();

    await runMutation(
      `UPDATE active_trip_session SET status = 'active', last_updated = ? WHERE session_id = ?`,
      [now, sessionId]
    );

    res.json({ success: true, status: 'active', lastUpdated: now });
  } catch (err) {
    console.error('[TripSession] Resume error:', err);
    res.status(500).json({ error: 'Failed to resume trip' });
  }
});

/**
 * POST /api/trip-session/:sessionId/complete
 * Mark trip as completed
 */
router.post('/:sessionId/complete', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const now = new Date().toISOString();

    await runMutation(
      `UPDATE active_trip_session SET status = 'completed', last_updated = ? WHERE session_id = ?`,
      [now, sessionId]
    );

    // Also update the trip record
    const sessions = await runQuery(
      `SELECT trip_id FROM active_trip_session WHERE session_id = ?`,
      [sessionId]
    );

    if (sessions.length > 0) {
      const tripId = (sessions[0] as any).trip_id;
      await runMutation(
        `UPDATE trip SET estimated_travel_time = (SELECT CAST((julianday(?) - julianday(start_time)) * 24 * 60 AS REAL) FROM trip WHERE trip_id = ?) WHERE trip_id = ?`,
        [now, tripId, tripId]
      );
    }

    res.json({ success: true, status: 'completed', completedAt: now });
  } catch (err) {
    console.error('[TripSession] Complete error:', err);
    res.status(500).json({ error: 'Failed to complete trip' });
  }
});

/**
 * POST /api/trip-session/:sessionId/cancel
 * Cancel active trip
 */
router.post('/:sessionId/cancel', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const now = new Date().toISOString();

    await runMutation(
      `UPDATE active_trip_session SET status = 'cancelled', last_updated = ? WHERE session_id = ?`,
      [now, sessionId]
    );

    res.json({ success: true, status: 'cancelled', cancelledAt: now });
  } catch (err) {
    console.error('[TripSession] Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel trip' });
  }
});

/**
 * GET /api/trip-session/:sessionId/live-status
 * Get comprehensive live status for active trip
 */
router.get('/:sessionId/live-status', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    // Get session
    const sessions = await runQuery(
      `SELECT * FROM active_trip_session WHERE session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[0] as any;
    const locations = JSON.parse(session.locations_json || '[]');
    const selectedRoutes = JSON.parse(session.selected_routes_json || '{}');

    // Get latest location update
    const latestLocations = await runQuery(
      `SELECT * FROM trip_location_update
       WHERE session_id = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [sessionId]
    );

    const currentLocation = latestLocations.length > 0
      ? {
          latitude: (latestLocations[0] as any).latitude,
          longitude: (latestLocations[0] as any).longitude,
          accuracy: (latestLocations[0] as any).accuracy,
          timestamp: (latestLocations[0] as any).timestamp
        }
      : null;

    // Get unresolved delay events
    const delays = await runQuery(
      `SELECT * FROM trip_delay_event
       WHERE session_id = ? AND resolved_at IS NULL
       ORDER BY created_at DESC`,
      [sessionId]
    );

    res.json({
      sessionId,
      tripId: session.trip_id,
      status: session.status,
      currentSegment: session.current_segment,
      currentStopIndex: session.current_stop_index,
      currentLocation,
      locations,
      selectedRoutes,
      delays: delays.map((d: any) => ({
        eventId: d.event_id,
        type: d.event_type,
        severity: d.severity,
        description: d.description,
        delayMinutes: d.delay_minutes,
        createdAt: d.created_at
      })),
      startedAt: session.started_at,
      lastUpdated: session.last_updated
    });
  } catch (err) {
    console.error('[TripSession] Live status error:', err);
    res.status(500).json({ error: 'Failed to get live status' });
  }
});

/**
 * GET /api/trip-session/user/:userId/active
 * Get active trip session for a user (if any)
 */
router.get('/user/:userId/active', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const sessions = await runQuery(
      `SELECT * FROM active_trip_session
       WHERE user_id = ? AND status IN ('active', 'paused')
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    );

    if (sessions.length === 0) {
      return res.json({ active: false });
    }

    const session = sessions[0] as any;

    res.json({
      active: true,
      sessionId: session.session_id,
      tripId: session.trip_id,
      status: session.status,
      startedAt: session.started_at,
      locations: JSON.parse(session.locations_json || '[]'),
      selectedRoutes: JSON.parse(session.selected_routes_json || '{}')
    });
  } catch (err) {
    console.error('[TripSession] Get active error:', err);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

/**
 * GET /api/trip-session/device/:deviceId/active
 * Get active trip session for anonymous user by device ID (if any)
 */
router.get('/device/:deviceId/active', async (req, res) => {
  try {
    const deviceId = req.params.deviceId;

    const sessions = await runQuery(
      `SELECT * FROM active_trip_session
       WHERE device_id = ? AND status IN ('active', 'paused')
       ORDER BY started_at DESC
       LIMIT 1`,
      [deviceId]
    );

    if (sessions.length === 0) {
      return res.json({ active: false });
    }

    const session = sessions[0] as any;

    res.json({
      active: true,
      sessionId: session.session_id,
      tripId: session.trip_id,
      status: session.status,
      startedAt: session.started_at,
      locations: JSON.parse(session.locations_json || '[]'),
      selectedRoutes: JSON.parse(session.selected_routes_json || '{}')
    });
  } catch (err) {
    console.error('[TripSession] Get active error:', err);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

export default router;