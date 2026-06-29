import { BookmarkLocation } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mapStyle } from '@/styles/map-style';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';

type GeoResult = {
  formatted_address: string;
  lat: number;
  lng: number;
};

// Decode Google encoded polyline
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  if (!encoded) return [];

  const coords: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coords;
}

async function geocodeLocation(query: string): Promise<GeoResult[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured.');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status === 'OVER_QUERY_LIMIT' || json.status === 'REQUEST_DENIED') {
    throw new Error(`Geocoding failed: ${json.status}`);
  }

  return (json.results || []).slice(0, 5).map((r: any) => ({
    formatted_address: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

type RoutePolyline = {
  steps: {
    mode: 'WALKING' | 'TRANSIT';
    polyline?: string;
    color?: string;
  }[];
};

export default function MapWrapper({
  bookmarkLocations,
  initialRegion,
  onClearRoute,
  onDestinationSelected,
  onAlternateRoute,
  routePolylines,
  showSignIn,
  onSignIn,
}: {
  bookmarkLocations: BookmarkLocation[];
  initialRegion: Region;
  onClearRoute?: () => void;
  onDestinationSelected?: (origin: BookmarkLocation, destination: BookmarkLocation) => void;
  onAlternateRoute?: (currentLocation: BookmarkLocation, destination: BookmarkLocation) => void;
  routePolylines?: RoutePolyline[];
  showSignIn?: boolean;
  onSignIn?: () => void;
}) {
  const mapRef = useRef<MapView>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Theme colors
  const theme = isDark
    ? {
        card: '#2a2d33',
        text: '#FFFFFF',
        sub: '#A0A4A8',
        border: '#3d4148',
      }
    : {
        card: '#ffffff',
        text: '#000',
        sub: '#666666',
        border: '#d0d0d0',
      };

  console.log('[MapWrapper] RENDER bookmarkLocations:', bookmarkLocations.length);

  // Get current location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } catch (e) {
        console.error('Failed to get location:', e);
      }
    })();
  }, []);

  // Animate to fit markers when locations change
  useEffect(() => {
    if (bookmarkLocations.length >= 2 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        bookmarkLocations.map((loc) => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
        })),
        {
          edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
          animated: true,
        },
      );
    }
  }, [bookmarkLocations]);

  // Search handler with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchError(null);
    setSearchResults([]);
    setShowResults(true);

    if (!query.trim()) {
      setShowResults(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await geocodeLocation(query);
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError('No locations found.');
        }
      } catch (e) {
        setSearchError((e as Error).message || 'Search failed.');
      } finally {
        setSearchLoading(false);
      }
    }, 500);
  }, []);

  // Handle selecting a search result
  const handleSelectResult = useCallback(
    (result: GeoResult) => {
      const selected: BookmarkLocation = {
        latitude: result.lat,
        longitude: result.lng,
        name: result.formatted_address,
      };

      if (!currentLocation) {
        setSearchError('Unable to get your current location. Please enable location services.');
        return;
      }
      const origin: BookmarkLocation = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        name: 'Current Location',
      };
      onDestinationSelected?.(origin, selected);

      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
    },
    [currentLocation, onDestinationSelected],
  );

  // Build polylines for each step
  const polylines =
    routePolylines?.flatMap((route, routeIdx) =>
      route.steps
        .map((step, stepIdx) => {
          if (!step.polyline) return null;
          const coords = decodePolyline(step.polyline);
          if (coords.length === 0) return null;

          const color = step.mode === 'WALKING' ? '#888888' : step.color || '#0a7ea4';

          return (
            <Polyline
              key={`${routeIdx}-${stepIdx}`}
              coordinates={coords}
              strokeColor={color}
              strokeWidth={step.mode === 'WALKING' ? 3 : 5}
              strokeOpacity={step.mode === 'WALKING' ? 0.6 : 1.0}
              lineDashPattern={step.mode === 'WALKING' ? [6, 4] : undefined}
            />
          );
        })
        .filter(Boolean),
    ) || [];

  return (
    <>
      {/* Header Bar with Sign In and Search */}
      <View style={styles.headerBar}>
        {showSignIn && (
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={onSignIn}
          >
            <Text style={[styles.signInText, { color: theme.text }]}>Sign In</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.searchContainer, { backgroundColor: theme.card, flex: 1 }]}>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search destination..."
            placeholderTextColor={theme.sub}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => searchQuery && setShowResults(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResults(false);
              }}
            >
              <Text style={[styles.clearButtonText, { color: theme.sub }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results Dropdown */}
      {showResults && (
        <View
          style={[
            styles.resultsDropdown,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {searchLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#0a7ea4" />
              <Text style={[styles.loadingText, { color: theme.sub }]}>Searching...</Text>
            </View>
          )}
          {searchError && <Text style={styles.errorText}>{searchError}</Text>}
          {searchResults.map((result, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.resultItem, { borderBottomColor: theme.border }]}
              onPress={() => handleSelectResult(result)}
            >
              <Text style={[styles.resultMain, { color: theme.text }]} numberOfLines={1}>
                {result.formatted_address}
              </Text>
              <Text style={[styles.resultSub, { color: theme.sub }]}>
                {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        region={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        customMapStyle={isDark ? mapStyle : undefined}
      >
        {bookmarkLocations.map((loc, i) => (
          <Marker
            key={`${loc.latitude}-${loc.longitude}-${i}`}
            coordinate={loc}
            title={loc.name ?? `Stop ${i + 1}`}
          />
        ))}

        {/* Draw route polylines */}
        {polylines}

        {/* Fallback: direct line if no polylines */}
        {bookmarkLocations.length >= 2 && !routePolylines && (
          <Polyline coordinates={bookmarkLocations} strokeColor="#0a7ea4" strokeWidth={3} />
        )}
      </MapView>
    </>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 800,
  },
  headerBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  signInBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  signInText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
    marginRight: 4,
  },
  clearButtonText: {
    fontSize: 18,
  },
  resultsDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 12,
    right: 12,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
    maxHeight: 240,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    color: '#e74c3c',
    padding: 12,
    fontSize: 14,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  resultMain: {
    fontSize: 15,
    fontWeight: '500',
  },
  resultSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
