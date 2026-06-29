import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { BookmarkLocation } from '@/hooks/use-auth';

export type TripStatus = 'idle' | 'active' | 'paused' | 'completed' | 'cancelled';

export type TripSegment = {
  index: number;
  from: BookmarkLocation;
  to: BookmarkLocation;
  selectedRouteId: string;
  routeOptions: RouteOption[];
};

export type RouteOption = {
  id: string;
  summary: string;
  duration: string;
  distance: string;
  modes: string[];
  legs: any[];
};

export type LiveETA = {
  segmentIndex: number;
  stopId?: string;
  routeId?: string;
  stopName?: string;
  etaMinutes: number;
  distanceMeters: number;
  vehicleLocation?: { lat: number; lon: number };
  delayMinutes: number;
  status: 'on-time' | 'delayed' | 'approaching' | 'arrived' | 'no-data';
};

export type DelayAlert = {
  id: number;
  type: 'delay_detected' | 'connection_missed' | 'reroute_triggered';
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  delayMinutes: number;
  timestamp: Date;
};

export type TripContextType = {
  // Session state
  sessionId: number | null;
  tripId: number | null;
  status: TripStatus;

  // Route state
  segments: TripSegment[];
  currentSegmentIndex: number;
  currentStopIndex: number;

  // Live data
  currentLocation: { latitude: number; longitude: number } | null;
  liveETAs: LiveETA[];
  delayAlerts: DelayAlert[];

  // Actions
  startTrip: (locations: BookmarkLocation[], selectedRoutes: Record<number, number>) => Promise<boolean>;
  pauseTrip: () => Promise<void>;
  resumeTrip: () => Promise<void>;
  adjustTrip: (locations: BookmarkLocation[], selectedRoutes: Record<number, number>) => Promise<boolean>;
  completeTrip: () => Promise<void>;
  cancelTrip: () => Promise<void>;

  // Mode switching
  switchRouteMode: (segmentIndex: number, routeId: string) => Promise<boolean>;

  // Stop management
  addStop: (location: BookmarkLocation, atIndex: number) => Promise<boolean>;
  removeStop: (index: number) => Promise<boolean>;

  // Location tracking
  startLocationTracking: () => Promise<void>;
  stopLocationTracking: () => void;

  // Live updates
  fetchLiveETAs: () => Promise<void>;
  checkDelays: () => Promise<void>;

  // Utility
  clearDelayAlert: (alertId: number) => void;
};

const TripContext = createContext<TripContextType | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds
const ETA_REFRESH_INTERVAL = 30000; // 30 seconds
const DELAY_CHECK_INTERVAL = 60000; // 60 seconds

export function TripProvider({ children, userId, deviceId }: { children: React.ReactNode; userId?: number; deviceId?: string }) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [tripId, setTripId] = useState<number | null>(null);
  const [status, setStatus] = useState<TripStatus>('idle');
  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [liveETAs, setLiveETAs] = useState<LiveETA[]>([]);
  const [delayAlerts, setDelayAlerts] = useState<DelayAlert[]>([]);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const etaInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start trip
  const startTrip = useCallback(async (locations: BookmarkLocation[], selectedRoutes: Record<number, number>): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/trip-session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deviceId,
          locations,
          selectedRoutes
        })
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('[TripContext] Start trip error:', error);
        return false;
      }

      const data = await res.json();
      setSessionId(data.sessionId);
      setTripId(data.tripId);
      setStatus('active');

      // Build segments
      const tripSegments: TripSegment[] = [];
      for (let i = 0; i < locations.length - 1; i++) {
        tripSegments.push({
          index: i,
          from: locations[i],
          to: locations[i + 1],
          selectedRouteId: String(selectedRoutes[i] || 0),
          routeOptions: []
        });
      }
      setSegments(tripSegments);

      console.log('[TripContext] Trip started:', data.sessionId);
      return true;
    } catch (err) {
      console.error('[TripContext] startTrip error:', err);
      return false;
    }
  }, [userId, deviceId]);

  // Pause trip
  const pauseTrip = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_URL}/api/trip-session/${sessionId}/pause`, { method: 'POST' });
      setStatus('paused');
      stopLocationTracking();
    } catch (err) {
      console.error('[TripContext] pauseTrip error:', err);
    }
  }, [sessionId]);

  // Resume trip
  const resumeTrip = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_URL}/api/trip-session/${sessionId}/resume`, { method: 'POST' });
      setStatus('active');
      startLocationTracking();
    } catch (err) {
      console.error('[TripContext] resumeTrip error:', err);
    }
  }, [sessionId]);

  // Adjust trip (locations or routes)
  const adjustTrip = useCallback(async (locations: BookmarkLocation[], selectedRoutes: Record<number, number>): Promise<boolean> => {
    if (!sessionId) return false;

    try {
      const res = await fetch(`${API_URL}/api/trip-session/${sessionId}/adjust`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations,
          selectedRoutes,
          currentSegment: currentSegmentIndex
        })
      });

      if (!res.ok) return false;

      // Rebuild segments
      const tripSegments: TripSegment[] = [];
      for (let i = 0; i < locations.length - 1; i++) {
        tripSegments.push({
          index: i,
          from: locations[i],
          to: locations[i + 1],
          selectedRouteId: String(selectedRoutes[i] || 0),
          routeOptions: []
        });
      }
      setSegments(tripSegments);

      console.log('[TripContext] Trip adjusted');
      return true;
    } catch (err) {
      console.error('[TripContext] adjustTrip error:', err);
      return false;
    }
  }, [sessionId, currentSegmentIndex]);

  // Switch route mode for a segment
  const switchRouteMode = useCallback(async (segmentIndex: number, routeId: string): Promise<boolean> => {
    if (!sessionId) return false;

    setSegments(prev => {
      const updated = [...prev];
      if (updated[segmentIndex]) {
        updated[segmentIndex] = {
          ...updated[segmentIndex],
          selectedRouteId: routeId
        };
      }
      return updated;
    });

    // Persist to backend
    const selectedRoutes: Record<number, number> = {};
    segments.forEach((seg, idx) => {
      selectedRoutes[idx] = parseInt(seg.selectedRouteId);
    });
    selectedRoutes[segmentIndex] = parseInt(routeId);

    // Call adjustTrip with updated routes
    const locations = segments.map(seg => seg.from);
    locations.push(segments[segments.length - 1].to);

    await adjustTrip(locations, selectedRoutes);

    return true;
  }, [sessionId, segments, adjustTrip]);

  // Add stop
  const addStop = useCallback(async (location: BookmarkLocation, atIndex: number): Promise<boolean> => {
    if (!sessionId || segments.length === 0) return false;

    // Get current locations
    const locations = segments.map(seg => seg.from);
    locations.push(segments[segments.length - 1].to);

    // Insert new location
    locations.splice(atIndex, 0, location);

    // Build new selected routes
    const selectedRoutes: Record<number, number> = {};
    segments.forEach((seg, idx) => {
      if (idx >= atIndex) {
        selectedRoutes[idx + 1] = parseInt(seg.selectedRouteId);
      } else {
        selectedRoutes[idx] = parseInt(seg.selectedRouteId);
      }
    });

    // Call adjustTrip with new locations
    return adjustTrip(locations, selectedRoutes);
  }, [sessionId, segments, adjustTrip]);

  // Remove stop
  const removeStop = useCallback(async (index: number): Promise<boolean> => {
    if (!sessionId || segments.length === 0) return false;

    // Get current locations
    const locations = segments.map(seg => seg.from);
    locations.push(segments[segments.length - 1].to);

    // Remove location at index
    locations.splice(index, 1);

    // Build new selected routes (skip the removed index)
    const selectedRoutes: Record<number, number> = {};
    let newIdx = 0;
    segments.forEach((seg, idx) => {
      if (idx !== index && idx < segments.length - 1) {
        selectedRoutes[newIdx] = parseInt(seg.selectedRouteId);
        newIdx++;
      }
    });

    // Call adjustTrip with new locations
    return adjustTrip(locations, selectedRoutes);
  }, [sessionId, segments, adjustTrip]);

  // Complete trip
  const completeTrip = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_URL}/api/trip-session/${sessionId}/complete`, { method: 'POST' });
      setStatus('completed');
      stopLocationTracking();
      setSessionId(null);
      setTripId(null);
      console.log('[TripContext] Trip completed');
    } catch (err) {
      console.error('[TripContext] completeTrip error:', err);
    }
  }, [sessionId]);

  // Cancel trip
  const cancelTrip = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_URL}/api/trip-session/${sessionId}/cancel`, { method: 'POST' });
      setStatus('cancelled');
      stopLocationTracking();
      setSessionId(null);
      setTripId(null);
      console.log('[TripContext] Trip cancelled');
    } catch (err) {
      console.error('[TripContext] cancelTrip error:', err);
    }
  }, [sessionId]);

  // Start foreground location tracking
  const startLocationTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('[TripContext] Location permission denied');
        return;
      }

      // Stop any existing subscription
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      // Start foreground tracking (app must be open)
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: 50, // Update every 50 meters
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          setCurrentLocation({ latitude, longitude });

          // Send to backend
          if (sessionId) {
            try {
              await fetch(`${API_URL}/api/trip-session/${sessionId}/update-location`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  latitude,
                  longitude,
                  accuracy: location.coords.accuracy,
                  etaMinutes: 0, // Will be calculated by backend
                  distanceToNextStop: 0
                })
              });
            } catch (err) {
              console.error('[TripContext] Failed to update location:', err);
            }
          }
        }
      );

      console.log('[TripContext] Location tracking started');
    } catch (err) {
      console.error('[TripContext] startLocationTracking error:', err);
    }
  }, [sessionId]);

  // Stop location tracking
  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (etaInterval.current) {
      clearInterval(etaInterval.current);
      etaInterval.current = null;
    }

    if (delayInterval.current) {
      clearInterval(delayInterval.current);
      delayInterval.current = null;
    }

    console.log('[TripContext] Location tracking stopped');
  }, []);

  // Fetch live ETAs
  const fetchLiveETAs = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`${API_URL}/api/trip-session/${sessionId}/live-status`);
      if (res.ok) {
        const data = await res.json();
        setLiveETAs(data.etas || []);
        setCurrentSegmentIndex(data.currentSegment || 0);
        setCurrentStopIndex(data.currentStopIndex || 0);
      }
    } catch (err) {
      console.error('[TripContext] fetchLiveETAs error:', err);
    }
  }, [sessionId]);

  // Check for delays
  const checkDelays = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`${API_URL}/api/trip-session/${sessionId}/live-status`);
      if (res.ok) {
        const data = await res.json();

        if (data.delayStatus && data.delayStatus.isDelayed) {
          // Add delay alert
          const alert: DelayAlert = {
            id: Date.now(),
            type: 'delay_detected',
            severity: data.delayStatus.severity,
            description: `Delay of ${data.delayStatus.delayMinutes} minutes detected`,
            delayMinutes: data.delayStatus.delayMinutes,
            timestamp: new Date()
          };

          setDelayAlerts(prev => [...prev, alert]);
        }
      }
    } catch (err) {
      console.error('[TripContext] checkDelays error:', err);
    }
  }, [sessionId]);

  // Clear delay alert
  const clearDelayAlert = useCallback((alertId: number) => {
    setDelayAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Start/stop tracking based on trip status
  useEffect(() => {
    if (status === 'active') {
      startLocationTracking();

      // Start ETA refresh interval
      etaInterval.current = setInterval(fetchLiveETAs, ETA_REFRESH_INTERVAL);

      // Start delay check interval
      delayInterval.current = setInterval(checkDelays, DELAY_CHECK_INTERVAL);
    } else {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [status, startLocationTracking, stopLocationTracking, fetchLiveETAs, checkDelays]);

  const value: TripContextType = {
    sessionId,
    tripId,
    status,
    segments,
    currentSegmentIndex,
    currentStopIndex,
    currentLocation,
    liveETAs,
    delayAlerts,
    startTrip,
    pauseTrip,
    resumeTrip,
    adjustTrip,
    completeTrip,
    cancelTrip,
    switchRouteMode,
    addStop,
    removeStop,
    startLocationTracking,
    stopLocationTracking,
    fetchLiveETAs,
    checkDelays,
    clearDelayAlert
  };

  return (
    <TripContext.Provider value={value}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}