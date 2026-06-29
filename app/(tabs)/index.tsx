import { BookmarkLocation, useAuth, SearchHistoryItem } from '@/hooks/use-auth';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Region } from 'react-native-maps';
import MapWrapper from '../../components/map-wrapper';
import RouteInformation, { DepartureTime } from '../../components/route-information';
import { LiveVehicle } from '../../server/src/services/nvasService';

type RoutePolyline = {
  steps: {
    mode: 'WALKING' | 'TRANSIT';
    polyline?: string;
    color?: string;
  }[];
};

type RouteMode = 'destination' | 'alternate';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function HomeScreen() {
  const {
    activeBookmarkLocations,
    setActiveBookmarkLocations,
    user,
    fetchSearchHistory,
    saveSearchHistory,
  } = useAuth();
  const router = useRouter();
  const [displayLocations, setDisplayLocations] = useState<BookmarkLocation[]>([]);
  const [routeMode, setRouteMode] = useState<RouteMode>('alternate');
  const [tripName, setTripName] = useState<string>('');
  const [allRoutePolylines, setAllRoutePolylines] = useState<RoutePolyline[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(false);
  const [departureTimes, setDepartureTimes] = useState<DepartureTime[]>([]);
  const [transitRoutes, setTransitRoutes] = useState<string[]>([]);
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);

  // Load recent searches on mount and when user changes
  useEffect(() => {
    fetchSearchHistory().then(setRecentSearches);
  }, [user, fetchSearchHistory]);

  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen focus] activeBookmarkLocations:', activeBookmarkLocations.length);
      console.log(
        '[HomeScreen focus] activeBookmarkLocations data:',
        JSON.stringify(activeBookmarkLocations),
      );
      setDisplayLocations(activeBookmarkLocations);
      console.log('[HomeScreen focus] setDisplayLocations done');
    }, [activeBookmarkLocations]),
  );

  // Fetch live vehicles when transit routes change
  useEffect(() => {
    if (!transitRoutes.length) {
      setLiveVehicles([]);
      return;
    }

    const fetchLiveVehicles = async () => {
      try {
        const allVehicles = [];

        for (const route of transitRoutes) {
          console.log('[LiveVehicles] Fetching vehicles for route:', route);
          const res = await fetch(`${API_URL}/api/live/route/${route}`);
          const vehicles = await res.json();
          console.log('[LiveVehicles] Received vehicles for route', route, ':', vehicles.length, 'vehicles');
          allVehicles.push(...vehicles);
        }

        console.log('[LiveVehicles] Total vehicles:', allVehicles.length);
        setLiveVehicles(allVehicles);
      } catch (err) {
        console.error('[LiveVehicles] Fetch failed:', err);
      }
    };

    fetchLiveVehicles();
    const interval = setInterval(fetchLiveVehicles, 30000);
    return () => clearInterval(interval);
  }, [transitRoutes]);

  const clearRoute = useCallback(() => {
    setActiveBookmarkLocations([]);
    setTripName('');
    setDisplayLocations([]);
    setAllRoutePolylines([]);
    setSelectedRouteIndex(0);
    setIsAddingWaypoint(false);
    setDepartureTimes([]);
    setTransitRoutes([]);
    setLiveVehicles([]);
  }, [setActiveBookmarkLocations]);

  const region = useMemo((): Region => {
    console.log('[HomeScreen region] displayLocations:', displayLocations.length);
    if (displayLocations.length === 0) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.015,
        longitudeDelta: 0.0121,
      };
    }

    if (displayLocations.length === 1) {
      return {
        latitude: displayLocations[0].latitude,
        longitude: displayLocations[0].longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.0121,
      };
    }

    const lats = displayLocations.map((l) => l.latitude);
    const lngs = displayLocations.map((l) => l.longitude);
    const padding = 0.01;
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats), 0.01) + padding,
      longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs), 0.01) + padding,
    };
  }, [displayLocations]);

  // Callback for when a destination is selected from the map search
  const handleDestinationSelected = useCallback(async (origin: BookmarkLocation, destination: BookmarkLocation) => {
    const locations = [origin, destination];
    setDisplayLocations(locations);
    setTripName('Route to Destination');
    setSelectedRouteIndex(0);
    setIsAddingWaypoint(false);

    // Save to search history
    await saveSearchHistory(locations);
    const updated = await fetchSearchHistory();
    setRecentSearches(updated);
  }, [saveSearchHistory, fetchSearchHistory]);

  const handleAlternateRoute = useCallback(
    (currentLocation: BookmarkLocation, destination: BookmarkLocation) => {
      setDisplayLocations([currentLocation, destination]);
      setTripName('Alternate Route');
      setRouteMode('alternate');
      setSelectedRouteIndex(0);
    },
    [],
  );

  // Callback for when routes are loaded
  const handleRoutesLoaded = useCallback((polylines: RoutePolyline[]) => {
    setAllRoutePolylines(polylines);
    setSelectedRouteIndex(0); // Select first route by default
  }, []);

  // Handle selecting a recent search
  const handleSelectRecentSearch = useCallback((locations: BookmarkLocation[]) => {
    setDisplayLocations(locations);
    setTripName(locations.length > 2 ? 'Multi-Stop Route' : 'Recent Route');
    setSelectedRouteIndex(0);
    setActiveBookmarkLocations(locations);
    setIsAddingWaypoint(false);
  }, [setActiveBookmarkLocations]);

  // Handle adding a waypoint
  const handleAddWaypoint = useCallback(() => {
    setIsAddingWaypoint(true);
  }, []);

  // Handle waypoint added from search
  const handleWaypointAdded = useCallback(async (waypoint: BookmarkLocation) => {
    // Insert waypoint before destination
    const newLocations = [...displayLocations];
    newLocations.splice(newLocations.length - 1, 0, waypoint);
    setDisplayLocations(newLocations);
    setActiveBookmarkLocations(newLocations);
    setIsAddingWaypoint(false);

    // Save updated route to search history
    await saveSearchHistory(newLocations);
    const updated = await fetchSearchHistory();
    setRecentSearches(updated);
  }, [displayLocations, setActiveBookmarkLocations, saveSearchHistory, fetchSearchHistory]);

  // Handle removing a waypoint
  const handleRemoveWaypoint = useCallback(async (index: number) => {
    const newLocations = displayLocations.filter((_, i) => i !== index);
    setDisplayLocations(newLocations);
    setActiveBookmarkLocations(newLocations);

    // Save updated route to search history if still valid
    if (newLocations.length >= 2) {
      await saveSearchHistory(newLocations);
      const updated = await fetchSearchHistory();
      setRecentSearches(updated);
    }
  }, [displayLocations, setActiveBookmarkLocations, saveSearchHistory, fetchSearchHistory]);

  // Handle reordering stops
  const handleReorderStops = useCallback(async (fromIndex: number, toIndex: number) => {
    const newLocations = [...displayLocations];
    const [removed] = newLocations.splice(fromIndex, 1);
    newLocations.splice(toIndex, 0, removed);

    setDisplayLocations(newLocations);
    setActiveBookmarkLocations(newLocations);
    setTripName(newLocations.length > 2 ? 'Multi-Stop Route' : 'Route to Destination');

    // Reset departure times when stops are reordered
    setDepartureTimes([]);

    // Save reordered route to search history
    await saveSearchHistory(newLocations);
    const updated = await fetchSearchHistory();
    setRecentSearches(updated);
  }, [displayLocations, setActiveBookmarkLocations, saveSearchHistory, fetchSearchHistory]);

  // Handle departure time change for a section
  const handleDepartureTimeChange = useCallback((sectionIndex: number, time: string) => {
    setDepartureTimes(prev => {
      // Remove existing entry for this section
      const filtered = prev.filter(d => d.sectionIndex !== sectionIndex);
      // Add new entry
      return [...filtered, { sectionIndex, time }];
    });
  }, []);

  // Get the polyline for the selected route only
  const selectedRoutePolyline = useMemo(() => {
    if (allRoutePolylines.length === 0) return [];
    const idx = Math.min(selectedRouteIndex, allRoutePolylines.length - 1);
    return [allRoutePolylines[idx]];
  }, [allRoutePolylines, selectedRouteIndex]);

  console.log('[HomeScreen render] displayLocations:', displayLocations.length);
  return (
    <View style={styles.container}>
      <MapWrapper
        bookmarkLocations={displayLocations}
        initialRegion={region}
        onClearRoute={clearRoute}
        onDestinationSelected={handleDestinationSelected}
        onAlternateRoute={handleAlternateRoute}
        routePolylines={selectedRoutePolyline}
        liveVehicles={liveVehicles}
        showSignIn={!user}
        onSignIn={() => router.push('/login')}
        recentSearches={recentSearches}
        onSelectRecentSearch={handleSelectRecentSearch}
        isAddingWaypoint={isAddingWaypoint}
        onWaypointAdded={handleWaypointAdded}
      />
      <RouteInformation
        locations={displayLocations}
        name={tripName || undefined}
        onClear={clearRoute}
        onRoutesLoaded={handleRoutesLoaded}
        onRouteSelected={setSelectedRouteIndex}
        onTransitRoutesChanged={setTransitRoutes}
        selectedRouteIndex={selectedRouteIndex}
        onAddWaypoint={handleAddWaypoint}
        onRemoveWaypoint={handleRemoveWaypoint}
        onReorderStops={handleReorderStops}
        isAddingWaypoint={isAddingWaypoint}
        onCancelAddWaypoint={() => setIsAddingWaypoint(false)}
        departureTimes={departureTimes}
        onDepartureTimeChange={handleDepartureTimeChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});