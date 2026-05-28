import * as Location from 'expo-location';
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { BookmarkLocation } from '@/hooks/use-auth';

export default function MapWrapper({
  bookmarkLocations,
  initialRegion,
}: {
  bookmarkLocations: BookmarkLocation[];
  initialRegion: Region;
}) {
  const mapRef = useRef<MapView>(null);

  console.log('[MapWrapper] RENDER bookmarkLocations:', bookmarkLocations.length);

  useEffect(() => {
    (async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
        await Location.getCurrentPositionAsync({});
      } catch (e) {
        console.error('Failed to get location:', e);
      }
    })();
  }, []);

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      style={styles.map}
      region={initialRegion}
      showsUserLocation
      showsMyLocationButton
    >
      {bookmarkLocations.map((loc, i) => (
        <Marker
          key={i}
          coordinate={loc}
          title={loc.name ?? `Stop ${i + 1}`}
          description={`${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
        />
      ))}
      {bookmarkLocations.length >= 2 && (
        <Polyline
          coordinates={bookmarkLocations}
          strokeColor="#0a7ea4"
          strokeWidth={3}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 800,
  },
});
