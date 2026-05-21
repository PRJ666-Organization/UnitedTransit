import React, { useState, useEffect } from 'react';
import * as Location from 'expo-location';

function WebMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <iframe
      src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
      style={webIframeStyle}
      title="Map"
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

const webIframeStyle: React.CSSProperties = {
  width: '100%',
  height: 800,
};

export default function MapWrapper() {
  const [location, setLocation] = useState({ latitude: 37.78825, longitude: -122.4324 });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (e) {
        console.error('Failed to get location:', e);
      }
    })();
  }, []);

  return <WebMap latitude={location.latitude} longitude={location.longitude} />;
}