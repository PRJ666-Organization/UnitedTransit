import { getVehiclesByRoute } from './nvasService';

interface StopLocation {
  latitude: number;
  longitude: number;
  name?: string;
  stopId?: string;
}

interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  routeId?: string;
  tripId?: string;
}

interface ETAResult {
  segmentIndex: number;
  stopId?: string;
  routeId?: string;
  stopName?: string;
  etaMinutes: number;
  distanceMeters: number;
  vehicleLocation?: { lat: number; lon: number };
  delayMinutes: number;
  status: 'on-time' | 'delayed' | 'approaching' | 'arrived' | 'no-data';
}

// Haversine distance calculation (meters)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(x: number): number {
  return (x * Math.PI) / 180;
}

/**
 * Find the nearest vehicle to a given stop location
 */
function findNearestVehicle(
  vehicles: VehiclePosition[],
  stop: StopLocation
): { vehicle: VehiclePosition; distance: number } | null {
  if (vehicles.length === 0) return null;

  let nearestVehicle = vehicles[0];
  let minDistance = haversineDistance(
    vehicles[0].latitude,
    vehicles[0].longitude,
    stop.latitude,
    stop.longitude
  );

  for (const vehicle of vehicles) {
    const distance = haversineDistance(
      vehicle.latitude,
      vehicle.longitude,
      stop.latitude,
      stop.longitude
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestVehicle = vehicle;
    }
  }

  return { vehicle: nearestVehicle, distance: minDistance };
}

/**
 * Calculate live ETAs for upcoming stops in a journey
 * Uses GTFS-RT vehicle positions to estimate arrival times
 *
 * @param currentLocation - User's current position
 * @param stops - Array of stop locations for the journey
 * @param routeIds - Array of route IDs for each segment
 * @param segmentIndex - Current segment the user is on
 * @returns Array of ETAResults for each remaining stop
 */
export async function calculateLiveETA(
  currentLocation: { latitude: number; longitude: number },
  stops: StopLocation[],
  routeIds: string[],
  segmentIndex: number
): Promise<ETAResult[]> {
  const results: ETAResult[] = [];

  for (let i = segmentIndex; i < stops.length; i++) {
    const stop = stops[i];
    const routeId = routeIds[i] || '';

    try {
      // Get live vehicles on this route
      const vehicles = await getVehiclesByRoute(routeId);

      if (vehicles.length > 0) {
        // Find nearest vehicle to stop
        const nearest = findNearestVehicle(vehicles, stop);

        if (nearest) {
          const distanceToStop = nearest.distance;
          // Rough estimate: ~350m per stop, average 2 min per stop
          const stopsAway = Math.round(distanceToStop / 350);
          const etaMinutes = stopsAway * 2;

          // Determine status
          let status: ETAResult['status'];
          if (distanceToStop < 100) {
            status = 'approaching';
          } else if (etaMinutes <= 2) {
            status = 'on-time';
          } else if (etaMinutes > 10) {
            status = 'delayed';
          } else {
            status = 'on-time';
          }

          results.push({
            segmentIndex: i,
            stopId: stop.stopId,
            routeId: routeId,
            stopName: stop.name,
            etaMinutes,
            distanceMeters: distanceToStop,
            vehicleLocation: {
              lat: nearest.vehicle.latitude,
              lon: nearest.vehicle.longitude
            },
            delayMinutes: 0, // TODO: Compare with scheduled time
            status
          });
        } else {
          // No vehicles found - use distance estimate
          const dist = haversineDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            stop.latitude,
            stop.longitude
          );
          results.push({
            segmentIndex: i,
            stopId: stop.stopId,
            routeId: routeId,
            stopName: stop.name,
            etaMinutes: Math.round((dist / 1000) * 3), // 3 min per km walking
            distanceMeters: dist,
            delayMinutes: 0,
            status: 'no-data'
          });
        }
      } else {
        // No live vehicle data - use distance estimate
        const dist = haversineDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          stop.latitude,
          stop.longitude
        );
        results.push({
          segmentIndex: i,
          stopId: stop.stopId,
          routeId: routeId,
          stopName: stop.name,
          etaMinutes: Math.round((dist / 1000) * 3), // 3 min per km walking
          distanceMeters: dist,
          delayMinutes: 0,
          status: 'no-data'
        });
      }
    } catch (err) {
      console.error(`[ETACalculator] Error calculating ETA for stop ${i}:`, err);
      // Return fallback estimate
      const dist = haversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        stop.latitude,
        stop.longitude
      );
      results.push({
        segmentIndex: i,
        stopId: stop.stopId,
        routeId: routeId,
        stopName: stop.name,
        etaMinutes: Math.round((dist / 1000) * 3),
        distanceMeters: dist,
        delayMinutes: 0,
        status: 'no-data'
      });
    }
  }

  return results;
}

/**
 * Detect delays by comparing live ETAs against scheduled times
 *
 * @param sessionId - Active trip session ID
 * @param currentETA - Current live ETA results
 * @param scheduledTime - Scheduled arrival/departure time
 * @returns Delay status
 */
export async function detectDelays(
  sessionId: number,
  currentETA: ETAResult[],
  scheduledTime: Date
): Promise<{
  isDelayed: boolean;
  delayMinutes: number;
  shouldReroute: boolean;
  severity: 'minor' | 'moderate' | 'severe' | 'none';
}> {
  // Thresholds for delay severity
  const MINOR_THRESHOLD = 3; // 3-5 minutes
  const MODERATE_THRESHOLD = 5; // 5-10 minutes
  const SEVERE_THRESHOLD = 10; // 10+ minutes

  // Find the most significant delay
  let maxDelay = 0;

  for (const eta of currentETA) {
    if (eta.status === 'delayed' && eta.delayMinutes > maxDelay) {
      maxDelay = eta.delayMinutes;
    }
  }

  // Determine severity
  let severity: 'minor' | 'moderate' | 'severe' | 'none' = 'none';
  if (maxDelay >= SEVERE_THRESHOLD) {
    severity = 'severe';
  } else if (maxDelay >= MODERATE_THRESHOLD) {
    severity = 'moderate';
  } else if (maxDelay >= MINOR_THRESHOLD) {
    severity = 'minor';
  }

  const isDelayed = maxDelay > MINOR_THRESHOLD;
  const shouldReroute = severity === 'severe' || severity === 'moderate';

  return {
    isDelayed,
    delayMinutes: maxDelay,
    shouldReroute,
    severity
  };
}

/**
 * Get stop location from GTFS database
 *
 * @param stopId - GTFS stop ID
 * @returns Stop location or null if not found
 */
export async function getStopLocation(stopId: string): Promise<StopLocation | null> {
  try {
    const { runQuery } = require('../db/database');
    const stops = await runQuery(
      `SELECT stop_id, stop_name, stop_lat, stop_lon FROM gtfs_stops WHERE stop_id = ?`,
      [stopId]
    );

    if (stops.length === 0) {
      return null;
    }

    const stop = stops[0] as any;
    return {
      stopId: stop.stop_id,
      name: stop.stop_name,
      latitude: stop.stop_lat,
      longitude: stop.stop_lon
    };
  } catch (err) {
    console.error('[ETACalculator] Error getting stop location:', err);
    return null;
  }
}

/**
 * Get scheduled arrival time from GTFS
 *
 * @param tripId - GTFS trip ID
 * @param stopId - GTFS stop ID
 * @returns Scheduled arrival time or null
 */
export async function getScheduledArrival(
  tripId: string,
  stopId: string
): Promise<string | null> {
  try {
    const { runQuery } = require('../db/database');
    const times = await runQuery(
      `SELECT arrival_time FROM gtfs_stop_times
       WHERE trip_id = ? AND stop_id = ?
       ORDER BY stop_sequence
       LIMIT 1`,
      [tripId, stopId]
    );

    if (times.length === 0) {
      return null;
    }

    return (times[0] as any).arrival_time;
  } catch (err) {
    console.error('[ETACalculator] Error getting scheduled arrival:', err);
    return null;
  }
}

/**
 * Calculate comprehensive trip status including delays and ETAs
 *
 * @param sessionId - Active trip session ID
 * @param currentLocation - User's current position
 * @param stops - Array of stop locations
 * @param routeIds - Array of route IDs
 * @param segmentIndex - Current segment index
 * @returns Comprehensive trip status
 */
export async function getTripStatus(
  sessionId: number,
  currentLocation: { latitude: number; longitude: number },
  stops: StopLocation[],
  routeIds: string[],
  segmentIndex: number
): Promise<{
  etas: ETAResult[];
  delayStatus: {
    isDelayed: boolean;
    delayMinutes: number;
    shouldReroute: boolean;
    severity: 'minor' | 'moderate' | 'severe' | 'none';
  };
  currentSegment: number;
}> {
  // Calculate ETAs
  const etas = await calculateLiveETA(currentLocation, stops, routeIds, segmentIndex);

  // Detect delays
  const now = new Date();
  const delayStatus = await detectDelays(sessionId, etas, now);

  return {
    etas,
    delayStatus,
    currentSegment: segmentIndex
  };
}