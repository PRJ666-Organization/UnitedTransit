import { BookmarkLocation } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Autocomplete,
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
  type Libraries,
} from '@react-google-maps/api';
import React, { useEffect, useMemo, useRef, useState } from 'react';

const LIBRARIES: Libraries = ['places'];

type RoutePolyline = {
  steps: {
    mode: 'WALKING' | 'TRANSIT';
    polyline?: string;
    color?: string;
  }[];
};

// Decode Google encoded polyline
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  if (!encoded) return [];

  const coords: { lat: number; lng: number }[] = [];
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
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coords;
}

export default function MapWrapper({
  bookmarkLocations,
  initialRegion,
  onClearRoute,
  onDestinationSelected,
  onAlternateRoute,
  onAddStop,
  routePolylines,
  showSignIn,
  onSignIn,
}: {
  bookmarkLocations: BookmarkLocation[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onClearRoute?: () => void;
  onDestinationSelected?: (origin: BookmarkLocation, destination: BookmarkLocation) => void;
  onAlternateRoute?: (currentLocation: BookmarkLocation, destination: BookmarkLocation) => void;
  onAddStop?: (stop: BookmarkLocation) => void;
  routePolylines?: RoutePolyline[];
  showSignIn?: boolean;
  onSignIn?: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const mapRef = useRef<any>(null);
  const autoCompleteRef = useRef<any>(null);

  const [home, setHome] = useState<{ lat: number; lng: number } | null>(null);
  const [addStopMode, setAddStopMode] = useState(false);
  const [heading, setHeading] = useState(0);

  const [useAlternateRoute, setUseAlternateRoute] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const prevHeadingRef = useRef(0);

  function getSmoothHeading(newHeading: number) {
    const prev = prevHeadingRef.current;

    let diff = newHeading - prev;

    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const result = prev + diff;
    prevHeadingRef.current = result;

    return result;
  }

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setHome({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => console.warn(err),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!window.google?.maps || bookmarkLocations.length < 2 || !mapRef.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    bookmarkLocations.forEach((loc) => {
      bounds.extend({ lat: loc.latitude, lng: loc.longitude });
    });
    mapRef.current.fitBounds(bounds);
  }, [bookmarkLocations, isLoaded]);

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map;

    setHeading(map.getHeading() || 0);

    map.addListener('heading_changed', () => {
      setHeading(map.getHeading() || 0);
      console.log('HEADING UPDATED');
    });
  };

  const onPlaceChanged = () => {
    const place = autoCompleteRef.current.getPlace();
    if (!place.geometry || !place.geometry.location) return;

    const destination: BookmarkLocation = {
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      name: place.formatted_address || place.name || 'Selected Destination',
    };

    // Add stop mode takes priority
    if (addStopMode && onAddStop) {
      onAddStop(destination);
      setAddStopMode(false);
      return;
    }

    // Alternate route (CURRENT LOCATION to destination)
    if (useAlternateRoute) {
      if (!currentLocation) return;

      const currentLoc: BookmarkLocation = {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        name: 'Current Location',
      };

      onAlternateRoute?.(currentLoc, destination);
      return;
    }

    // Default route (HOME to destination)
    if (home && onDestinationSelected) {
      const origin: BookmarkLocation = {
        latitude: home.lat,
        longitude: home.lng,
        name: 'Home',
      };

      onDestinationSelected?.(origin, destination);
      return;
    }

    // Fallback
    if (mapRef.current) {
      mapRef.current.panTo({
        lat: destination.latitude,
        lng: destination.longitude,
      });
      mapRef.current.setZoom(14);
    }
  };

  const center = useMemo(() => {
    if (bookmarkLocations.length === 0) {
      // Default to home or a fallback
      return home || { lat: 43.6532, lng: -79.3832 };
    }
    const lats = bookmarkLocations.map((l) => l.latitude);
    const lngs = bookmarkLocations.map((l) => l.longitude);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }, [bookmarkLocations, home]);

  const zoom = useMemo(() => {
    if (bookmarkLocations.length === 0) return 14;
    if (bookmarkLocations.length === 1) return 15;
    const lats = bookmarkLocations.map((l) => l.latitude);
    const lngs = bookmarkLocations.map((l) => l.longitude);
    const latDelta = Math.max(...lats) - Math.min(...lats);
    const lngDelta = Math.max(...lngs) - Math.min(...lngs);
    const maxDelta = Math.max(latDelta, lngDelta);
    if (maxDelta < 0.01) return 15;
    if (maxDelta < 0.05) return 13;
    if (maxDelta < 0.1) return 12;
    return 10;
  }, [bookmarkLocations]);

  const polylineCoords = useMemo(
    () => bookmarkLocations.map((loc) => ({ lat: loc.latitude, lng: loc.longitude })),
    [bookmarkLocations],
  );

  // Build polylines from route data
  const routePolylineCoords = useMemo(() => {
    if (!routePolylines || routePolylines.length === 0) return [];

    return routePolylines
      .flatMap((route) =>
        route.steps
          .map((step) => {
            if (!step.polyline) return null;
            const coords = decodePolyline(step.polyline);
            return {
              coords,
              color: step.mode === 'WALKING' ? '#666666' : step.color || '#4A90E2',
              isWalking: step.mode === 'WALKING',
            };
          })
          .filter(Boolean),
      )
      .flat();
  }, [routePolylines]);

  if (loadError) return <div>Map failed to load</div>;
  if (!isLoaded) return <div>Loading map...</div>;

  const smoothHeading = getSmoothHeading(heading);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        {showSignIn && (
          <button
            onClick={onSignIn}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
            }}
          >
            Sign In
          </button>
        )}

        <Autocomplete
          onLoad={(ref) => (autoCompleteRef.current = ref)}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: 'ca' },
          }}
        >
          <input
            type="text"
            placeholder={addStopMode ? 'Search stop to add...' : 'Search destination...'}
            style={{
              width: '300px',
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${addStopMode ? '#0a7ea4' : '#ccc'}`,
            }}
          />
        </Autocomplete>

        {home && (
          <button
            onClick={() => {
              mapRef.current?.panTo(home);
              mapRef.current?.setZoom(14);
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Home
          </button>
        )}

        {bookmarkLocations.length >= 2 && onAddStop && (
          <button
            onClick={() => setAddStopMode((m) => !m)}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: `1px solid ${addStopMode ? '#0a7ea4' : '#ccc'}`,
              background: addStopMode ? '#0a7ea4' : '#fff',
              color: addStopMode ? '#fff' : '#111',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {addStopMode ? 'Cancel Add Stop' : '+ Add Stop'}
          </button>
        )}

        {bookmarkLocations.length > 0 && (
          <button
            onClick={() => {
              onClearRoute?.();
              setAddStopMode(false);
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Clear Route
          </button>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 8px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          }}
        >
          <input
            type="checkbox"
            checked={useAlternateRoute}
            onChange={(e) => setUseAlternateRoute(e.target.checked)}
            style={{
              accentColor: '#0a7ea4',
            }}
          />
          Alt Route
        </label>
      </div>

      <button
        onClick={() => mapRef.current?.setHeading(0)}
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          zIndex: 1000,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '1px solid #ccc',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          style={{
            transform: `rotate(${-smoothHeading}deg)`,
            transition: 'transform 150ms ease',
          }}
        >
          <path d="M12 2 L16 12 L12 10 L8 12 Z" fill="#E53935" />
          <path d="M12 22 L16 12 L12 14 L8 12 Z" fill="#666" />
        </svg>
      </button>

      <GoogleMap
        onLoad={onLoad}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        options={{
          mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
          rotateControl: true,
        }}
      >
        {bookmarkLocations.map((loc, i) => (
          <Marker
            key={i}
            position={{ lat: loc.latitude, lng: loc.longitude }}
            title={loc.name ?? `Stop ${i + 1}`}
          />
        ))}

        {/* Draw route polylines if available */}
        {routePolylineCoords.length > 0
          ? routePolylineCoords.map((pl, idx) => (
              <React.Fragment key={idx}>
                {/* Outline layer rendered underneath */}
                <Polyline
                  path={pl!.coords}
                  options={{
                    strokeColor: '#000000',
                    strokeWeight: pl!.isWalking ? 5 : 9,
                    strokeOpacity: pl!.isWalking ? 0.9 : 0.8,
                    zIndex: pl!.isWalking ? 1 : 2,
                  }}
                />
                <Polyline
                  path={pl!.coords}
                  options={{
                    strokeColor: pl!.color,
                    strokeWeight: pl!.isWalking ? 4 : 7,
                    strokeOpacity: pl!.isWalking ? 0.6 : 1.0,
                    zIndex: pl!.isWalking ? 1 : 2,
                    icons: pl!.isWalking
                      ? [
                          {
                            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                            offset: '0',
                            repeat: '10px',
                          },
                        ]
                      : undefined,
                  }}
                />
              </React.Fragment>
            ))
          : // Fallback: direct line if no polylines
            polylineCoords.length > 1 && (
              <React.Fragment>
                <Polyline
                  path={polylineCoords}
                  options={{
                    strokeColor: '#000000',
                    strokeWeight: 7,
                    strokeOpacity: 0.4,
                  }}
                />
                <Polyline
                  path={polylineCoords}
                  options={{
                    strokeColor: '#4A90E2',
                    strokeWeight: 4,
                    strokeOpacity: 0.8,
                  }}
                />
              </React.Fragment>
            )}
      </GoogleMap>
    </div>
  );
}
