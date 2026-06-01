import { mapStyle } from '@/styles/map-style';
import { BookmarkLocation } from '@/hooks/use-auth';
import {
  Autocomplete,
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function MapWrapper({
  bookmarkLocations,
  initialRegion,
  onClearRoute,
}: {
  bookmarkLocations: BookmarkLocation[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onClearRoute?: () => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  const mapRef = useRef<any>(null);
  const autoCompleteRef = useRef<any>(null);

  const [home, setHome] = useState({ lat: 43.6532, lng: -79.3832 });

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
    const newCenter = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };
    mapRef.current?.panTo(newCenter);
    mapRef.current?.setZoom(14);
  };

  const center = useMemo(() => {
    if (bookmarkLocations.length === 0) return home;
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

  if (loadError) return <div>Map failed to load</div>;
  if (!isLoaded) return <div>Loading map...</div>;

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
        <Autocomplete
          onLoad={(ref) => (autoCompleteRef.current = ref)}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: 'ca' },
          }}
        >
          <input
            type="text"
            placeholder="Search a location"
            style={{
              width: '300px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ccc',
            }}
          />
        </Autocomplete>

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

      <GoogleMap
        onLoad={onLoad}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        options={{
          styles: mapStyle,
        }}
      >
        {bookmarkLocations.map((loc, i) => (
          <Marker
            key={i}
            position={{ lat: loc.latitude, lng: loc.longitude }}
            title={loc.name ?? `Stop ${i + 1}`}
          />
        ))}

        {polylineCoords.length > 1 && (
          <Polyline
            path={polylineCoords}
            options={{
              strokeColor: '#4A90E2',
              strokeWeight: 4,
              strokeOpacity: 0.8,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
