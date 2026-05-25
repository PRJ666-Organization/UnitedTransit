import { mapStyle } from '@/styles/map-style';
import {
  Autocomplete,
  DirectionsRenderer,
  GoogleMap,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useEffect, useRef, useState } from 'react';

export default function MapWrapper({ children }: any) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  const mapRef = useRef<any>(null);
  const autoCompleteRef = useRef<any>(null);

  const [home, setHome] = useState({ lat: 43.6532, lng: -79.3832 }); // Default to Toronto
  const [center, setCenter] = useState(home);
  const [directions, setDirections] = useState<any>(null);

  const goToUserLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
      const newHome = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setHome(newHome);
      setCenter(newHome);

      mapRef.current?.panTo(newHome);
      mapRef.current?.setZoom(18);
    });
  };

  useEffect(() => {
    goToUserLocation();
  }, []);

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

  const onPlaceChanged = () => {
    const place = autoCompleteRef.current.getPlace();

    if (!place.geometry || !place.geometry.location) return;

    const newCenter = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    setCenter(newCenter);

    mapRef.current?.panTo(newCenter);
    mapRef.current?.setZoom(18);

    calculateRoute(newCenter);
  };

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
            componentRestrictions: { country: 'ca' }, // Restrict to Canada
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
            mapRef.current?.setZoom(18);
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
      </div>

      {/* Map */}
      <GoogleMap
        onLoad={onLoad}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={18}
        options={{
          styles: mapStyle,
        }}
      >
        {/* Route Line */}
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

        {children}
      </GoogleMap>
    </div>
  );
}
