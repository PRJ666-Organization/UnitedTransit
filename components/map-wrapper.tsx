import React, { useState, useEffect } from 'react';
import { Platform, StyleSheet, View, ActivityIndicator } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapWrapper() {
  const [location, setLocation] = useState({ latitude: 37.78825, longitude: -122.4324 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const lat = Number(loc.coords.latitude);
        const lng = Number(loc.coords.longitude);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setLocation({
            latitude: lat,
            longitude: lng,
          });
        }
        setLoading(false);
      } catch (e) {
        console.error('Failed to get location:', e);
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.map}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <MapView
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      style={styles.map}
      region={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.0121,
      }}
      showsUserLocation
      showsMyLocationButton
    />
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 800,
  },
});
