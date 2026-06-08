import { BookmarkLocation, useAuth } from '@/hooks/use-auth';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Region } from 'react-native-maps';
import MapWrapper from '../../components/map-wrapper';
import RouteInformation from '../../components/route-information';

type RoutePolyline = {
  steps: {
    mode: 'WALKING' | 'TRANSIT';
    polyline?: string;
    color?: string;
  }[];
};

export default function HomeScreen() {
  const { activeBookmarkLocations, setActiveBookmarkLocations, user } = useAuth();
  const router = useRouter();
  const [displayLocations, setDisplayLocations] = useState<BookmarkLocation[]>([]);
  const [tripName, setTripName] = useState<string>('');
  const [allRoutePolylines, setAllRoutePolylines] = useState<RoutePolyline[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

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

  const clearRoute = useCallback(() => {
    setActiveBookmarkLocations([]);
    setTripName('');
    setDisplayLocations([]);
    setAllRoutePolylines([]);
    setSelectedRouteIndex(0);
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
  const handleDestinationSelected = useCallback((origin: BookmarkLocation, destination: BookmarkLocation) => {
    setDisplayLocations([origin, destination]);
    setTripName('Route to Destination');
    setSelectedRouteIndex(0);
  }, []);

  // Callback for when routes are loaded
  const handleRoutesLoaded = useCallback((polylines: RoutePolyline[]) => {
    setAllRoutePolylines(polylines);
    setSelectedRouteIndex(0); // Select first route by default
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
        routePolylines={selectedRoutePolyline}
        showSignIn={!user}
        onSignIn={() => router.push('/login')}
      />
      <RouteInformation
        locations={displayLocations}
        name={tripName || undefined}
        onClear={clearRoute}
        onRoutesLoaded={handleRoutesLoaded}
        onRouteSelected={setSelectedRouteIndex}
        selectedRouteIndex={selectedRouteIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
