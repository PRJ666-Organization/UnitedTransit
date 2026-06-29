import { mapStyle } from '@/styles/map-style';
import { BookmarkLocation, SearchHistoryItem, useAuth } from '@/hooks/use-auth';
import {
  Autocomplete,
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { LiveVehicle } from '../server/src/services/nvasService';

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

// Format relative time for recent searches
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function MapWrapper({
  bookmarkLocations,
  initialRegion,
  onClearRoute,
  onDestinationSelected,
  onAlternateRoute,
  routePolylines,
  liveVehicles = [],
  showSignIn,
  onSignIn,
  recentSearches,
  onSelectRecentSearch,
  isAddingWaypoint,
  onWaypointAdded,
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
  routePolylines?: RoutePolyline[];
  liveVehicles?: LiveVehicle[];
  showSignIn?: boolean;
  onSignIn?: () => void;
  recentSearches?: SearchHistoryItem[];
  onSelectRecentSearch?: (locations: BookmarkLocation[]) => void;
  isAddingWaypoint?: boolean;
  onWaypointAdded?: (waypoint: BookmarkLocation) => void;
}) {
  const { user, getHomeAddress } = useAuth();
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  const mapRef = useRef<any>(null);
  const autoCompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [home, setHome] = useState<{ lat: number; lng: number } | null>(null);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const homeLoadedRef = useRef(false);

  // Load home address if user is signed in
  useEffect(() => {
    if (user) {
      getHomeAddress().then((homeData) => {
        if (homeData.homeLat && homeData.homeLng) {
          setHome({
            lat: homeData.homeLat,
            lng: homeData.homeLng,
          });
          homeLoadedRef.current = true;
        }
      });
    }
  }, [user, getHomeAddress]);

  // Get current location as fallback (only if no saved home)
  useEffect(() => {
    if (!homeLoadedRef.current && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        // Only set current location if we haven't loaded a saved home
        if (!homeLoadedRef.current) {
          setHome({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      });
    }
  }, []); // Empty dependency - only run once on mount

  useEffect(() => {
    if (!window.google?.maps || bookmarkLocations.length < 2 || !mapRef.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    bookmarkLocations.forEach((loc) => {
      bounds.extend({ lat: loc.latitude, lng: loc.longitude });
    });
    mapRef.current.fitBounds(bounds);
  }, [bookmarkLocations, isLoaded]);

  const onLoad = (map: any) => {
    mapRef.current = map;
  };

  const onPlaceChanged = () => {
    const place = autoCompleteRef.current.getPlace();
    if (!place.geometry || !place.geometry.location) return;

    const location: BookmarkLocation = {
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      name: place.formatted_address || place.name || 'Selected Location',
    };

    // If in waypoint mode, add as waypoint
    if (isAddingWaypoint && onWaypointAdded) {
      onWaypointAdded(location);
      setShowRecentSearches(false);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // If we have the user's location and a callback, create a route
    if (home && onDestinationSelected) {
      const origin: BookmarkLocation = {
        latitude: home.lat,
        longitude: home.lng,
        name: 'Current Location',
      };
      onDestinationSelected(origin, location);
    } else if (mapRef.current) {
      // Fallback: just pan to the location
      mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
      mapRef.current.setZoom(14);
    }
    setShowRecentSearches(false);
  };

  // Handle selecting a recent search
  const handleSelectRecentSearch = useCallback((item: SearchHistoryItem) => {
    try {
      const locations: BookmarkLocation[] = JSON.parse(item.locations_json);
      onSelectRecentSearch?.(locations);
      setShowRecentSearches(false);
    } catch (e) {
      console.error('[MapWrapper Web] Failed to parse recent search:', e);
    }
  }, [onSelectRecentSearch]);

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

  const polylineCoords = useMemo(() =>
    bookmarkLocations.map((loc) => ({ lat: loc.latitude, lng: loc.longitude })),
    [bookmarkLocations],
  );

  // Build polylines from route data
  const routePolylineCoords = useMemo(() => {
    if (!routePolylines || routePolylines.length === 0) return [];

    return routePolylines.flatMap(route =>
      route.steps.map(step => {
        if (!step.polyline) return null;
        const coords = decodePolyline(step.polyline);
        return {
          coords,
          color: step.mode === 'WALKING' ? '#666666' : step.color || '#4A90E2',
          isWalking: step.mode === 'WALKING',
        };
      }).filter(Boolean)
    ).flat();
  }, [routePolylines]);

  if (loadError) return <div>Map failed to load</div>;
  if (!isLoaded) return <div>Loading map...</div>;

  console.log('WEB MAP RECEIVED VEHICLES:', liveVehicles);

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

        <div style={{ position: 'relative' }}>
          <Autocomplete
            onLoad={(ref) => (autoCompleteRef.current = ref)}
            onPlaceChanged={onPlaceChanged}
            options={{
              componentRestrictions: { country: 'ca' },
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={isAddingWaypoint ? "Search waypoint..." : "Search destination..."}
              style={{
                width: '300px',
                padding: '10px',
                borderRadius: '8px',
                border: isAddingWaypoint ? '2px solid #0a7ea4' : '1px solid #ccc',
              }}
              onFocus={() => {
                if (recentSearches && recentSearches.length > 0 && !inputRef.current?.value) {
                  setShowRecentSearches(true);
                }
              }}
              onBlur={() => {
                // Delay to allow click on recent search items
                setTimeout(() => setShowRecentSearches(false), 200);
              }}
              onChange={() => {
                if (inputRef.current?.value) {
                  setShowRecentSearches(false);
                }
              }}
            />
          </Autocomplete>

          {/* Recent Searches Dropdown */}
          {showRecentSearches && recentSearches && recentSearches.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                marginTop: '4px',
                maxHeight: '280px',
                overflowY: 'auto',
                zIndex: 20,
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#666',
                  padding: '10px',
                  paddingBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Recent Searches
              </div>
              {recentSearches.map((search) => {
                try {
                  const locations: BookmarkLocation[] = JSON.parse(search.locations_json);
                  const origin = locations[0]?.name || 'Unknown';
                  const dest = locations[locations.length - 1]?.name || 'Unknown';
                  const waypointCount = locations.length - 2;

                  return (
                    <div
                      key={search.search_id}
                      onClick={() => handleSelectRecentSearch(search)}
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#333', fontSize: '13px' }}>
                        {origin} → {dest}
                      </div>
                      {waypointCount > 0 && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '1px' }}>
                          +{waypointCount} stop{waypointCount > 1 ? 's' : ''}
                        </div>
                      )}
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                        {formatRelativeTime(search.searched_at)}
                      </div>
                    </div>
                  );
                } catch {
                  return null;
                }
              })}
            </div>
          )}
        </div>

        {home && user && (
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

        {bookmarkLocations.length > 0 && (
          <button
            onClick={() => onClearRoute?.()}
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
      </div>

      {/* Waypoint Mode Banner */}
      {isAddingWaypoint && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9,
            background: '#fff',
            borderRadius: '8px',
            border: '2px solid #0a7ea4',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <span style={{ fontWeight: 500 }}>📍 Search a location to add as waypoint</span>
        </div>
      )}

      <GoogleMap
        onLoad={onLoad}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        options={{
          styles: mapStyle,
        }}
      >
        {/* Markers with numbered labels and color coding */}
        {bookmarkLocations.map((loc, i) => {
          const label = String(i + 1); // 1, 2, 3, etc.
          const isOrigin = i === 0;
          const isDestination = i === bookmarkLocations.length - 1;
          const markerColor = isOrigin ? '#22c55e' : isDestination ? '#ef4444' : '#0a7ea4';

          return (
            <Marker
              key={i}
              position={{ lat: loc.latitude, lng: loc.longitude }}
              title={loc.name ?? `Stop ${i + 1}`}
              label={{
                text: label,
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
              icon={{
                path: 'M 0,-10 A 10,10 0 1,1 0,10 A 10,10 0 1,1 0,-10',
                fillColor: markerColor,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 1,
              }}
            />
          );
        })}

        {liveVehicles?.map((vehicle) => (
          <Marker
            key={vehicle.vehicleId}
            position={{
              lat: vehicle.latitude,
              lng: vehicle.longitude,
            }}
            title={`TTC ${vehicle.routeId ?? ''}`}
            label="🚌"
          />
        ))}

        {/* Draw route polylines if available */}
        {routePolylineCoords.length > 0 ? (
          routePolylineCoords.map((pl, idx) => (
            <Polyline
              key={idx}
              path={pl!.coords}
              options={{
                strokeColor: pl!.color,
                strokeWeight: pl!.isWalking ? 2 : 4,
                strokeOpacity: 0.8,
                icons: pl!.isWalking ? [
                  {
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                    offset: '0',
                    repeat: '10px',
                  },
                ] : undefined,
              }}
            />
          ))
        ) : (
          // Fallback: direct line if no polylines
          polylineCoords.length > 1 && (
            <Polyline
              path={polylineCoords}
              options={{
                strokeColor: '#4A90E2',
                strokeWeight: 4,
                strokeOpacity: 0.8,
              }}
            />
          )
        )}
      </GoogleMap>
    </div>
  );
}