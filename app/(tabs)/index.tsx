import MapWrapper from '../../components/map-wrapper';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Region } from 'react-native-maps';
import { useAuth, BookmarkLocation } from '@/hooks/use-auth';

export default function HomeScreen() {
  const { activeBookmarkLocations } = useAuth();
  const [displayLocations, setDisplayLocations] = useState<BookmarkLocation[]>([]);

  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen focus] activeBookmarkLocations:', activeBookmarkLocations.length);
      console.log('[HomeScreen focus] activeBookmarkLocations data:', JSON.stringify(activeBookmarkLocations));
      setDisplayLocations(activeBookmarkLocations);
      console.log('[HomeScreen focus] setDisplayLocations done');
    }, [activeBookmarkLocations]),
  );

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

  console.log('[HomeScreen render] displayLocations:', displayLocations.length);
  return <MapWrapper bookmarkLocations={displayLocations} initialRegion={region} />;
}
