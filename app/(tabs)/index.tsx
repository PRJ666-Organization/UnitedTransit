import { BookmarkLocation, useAuth } from '@/hooks/use-auth';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Region } from 'react-native-maps';
import MapWrapper from '../../components/map-wrapper';
import RouteInformation from '../../components/route-information';

export default function HomeScreen() {
  const { activeBookmarkLocations, setActiveBookmarkLocations, user } = useAuth();
  const router = useRouter();
  const [displayLocations, setDisplayLocations] = useState<BookmarkLocation[]>([]);
  const [tripName, setTripName] = useState<string>('');

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

  console.log('[HomeScreen render] displayLocations:', displayLocations.length);
  return (
    <View style={styles.container}>
      <MapWrapper
        bookmarkLocations={displayLocations}
        initialRegion={region}
        onClearRoute={clearRoute}
      />
      {!user && (
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>
      )}
      <RouteInformation
        locations={displayLocations}
        name={tripName || undefined}
        onClear={clearRoute}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loginButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
