import { mapStyle } from '@/styles/map-style';
import { BookmarkLocation } from '@/hooks/use-auth';
import {
  Autocomplete,
  DirectionsRenderer,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function MapWrapper({
  bookmarkLocations,
  initialRegion,
}: {
  bookmarkLocations: BookmarkLocation[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  const mapRef = useRef<any>(null);
  const autoCompleteRef = useRef<any>(null);

  const [home, setHome] = useState({ lat: 43.6532, lng: -79.3832 });
  const [directions, setDirections] = useState<any>(null);

  const goToUserLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const newHome = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setHome(newHome);
      mapRef.current?.panTo(newHome);
      mapRef.current?.setZoom(14);
    });
  };

  useEffect(() => {
    goToUserLocation();
  }, []);

  useEffect(() => {
    if (bookmarkLocations.length >= 2 && mapRef.current) {
      const bounds = new (window.google.maps.LatLngBounds)();
      bookmarkLocations.forEach((loc) => {
        bounds.extend({ lat: loc.latitude, lng: loc.longitude });
      });
      mapRef.current.fitBounds(bounds);
    }
  }, [bookmarkLocations]);

  const onLoad = (map: any) => {
    mapRef.current = map;
  };

  const calculateRoute = (destination: { lat: number; lng: number }) => {
    if (!window.google || !mapRef.current) return;
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: home,
        destination,
        travelMode: google.maps.TravelMode.TRANSIT,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result);
        }
      },
    );
  };

  const calculateBookmarkRoute = useCallback(() => {
    if (!window.google || bookmarkLocations.length < 2) return;
    const service = new google.maps.DirectionsService();

    const waypoints = bookmarkLocations.slice(1, -1).map((loc) => ({
      location: { lat: loc.latitude, lng: loc.longitude },
      stopover: true,
    }));

    service.route(
      {
        origin: { lat: bookmarkLocations[0].latitude, lng: bookmarkLocations[0].longitude },
        destination: {
          lat: bookmarkLocations[bookmarkLocations.length - 1].latitude,
          lng: bookmarkLocations[bookmarkLocations.length - 1].longitude,
        },
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result);
        }
      },
    );
  }, [bookmarkLocations]);

  useEffect(() => {
    calculateBookmarkRoute();
  }, [calculateBookmarkRoute]);

  const onPlaceChanged = () => {
    const place = autoCompleteRef.current.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    const newCenter = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };
    mapRef.current?.panTo(newCenter);
    mapRef.current?.setZoom(14);
    calculateRoute(newCenter);
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
            onClick={() => setDirections(null)}
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

        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              polylineOptions: {
                strokeColor: '#4A90E2',
                strokeWeight: 5,
              },
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
