type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Location = {
  latitude: number;
  longitude: number;
  name?: string;
};

function computeRegion(
  locations: Location[],
  defaultLocation: { latitude: number; longitude: number },
): Region {
  if (locations.length === 0) {
    return {
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.0121,
    };
  }

  if (locations.length === 1) {
    return {
      latitude: locations[0].latitude,
      longitude: locations[0].longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.0121,
    };
  }

  const lats = locations.map((l) => l.latitude);
  const lngs = locations.map((l) => l.longitude);
  const padding = 0.01;

  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats), 0.01) + padding,
    longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs), 0.01) + padding,
  };
}

describe('Map Region Calculation', () => {
  const defaultLocation = { latitude: 37.78825, longitude: -122.4324 };

  it('returns default region for empty locations', () => {
    const region = computeRegion([], defaultLocation);
    expect(region.latitude).toBe(37.78825);
    expect(region.longitude).toBe(-122.4324);
  });

  it('returns region centered on single location', () => {
    const region = computeRegion(
      [{ latitude: 43.6532, longitude: -79.3832, name: 'Test' }],
      defaultLocation,
    );
    expect(region.latitude).toBe(43.6532);
    expect(region.longitude).toBe(-79.3832);
  });

  it('computes bounding region for two locations', () => {
    const region = computeRegion(
      [
        { latitude: 43.796, longitude: -79.3486 },
        { latitude: 43.6605, longitude: -79.3746 },
      ],
      defaultLocation,
    );

    expect(region.latitude).toBeCloseTo(43.7283, 4);
    expect(region.longitude).toBeCloseTo(-79.3616, 4);
    expect(region.latitudeDelta).toBeGreaterThan(0.01);
    expect(region.longitudeDelta).toBeGreaterThan(0.01);
  });

  it('computes region for multiple locations', () => {
    const locations = [
      { latitude: 43.7, longitude: -79.4 },
      { latitude: 43.65, longitude: -79.35 },
      { latitude: 43.6, longitude: -79.5 },
    ];

    const region = computeRegion(locations, defaultLocation);

    expect(region.latitude).toBeCloseTo((43.7 + 43.6) / 2, 4);
    expect(region.longitude).toBeCloseTo((-79.35 + -79.5) / 2, 4);
  });

  it('applies padding to small deltas', () => {
    const locations = [
      { latitude: 43.6532, longitude: -79.3832 },
      { latitude: 43.6533, longitude: -79.3833 },
    ];

    const region = computeRegion(locations, defaultLocation);

    expect(region.latitudeDelta).toBe(0.02);
    expect(region.longitudeDelta).toBe(0.02);
  });

  it('handles locations with large spread', () => {
    const locations = [
      { latitude: 43.0, longitude: -80.0 },
      { latitude: 44.0, longitude: -78.0 },
    ];

    const region = computeRegion(locations, defaultLocation);

    expect(region.latitudeDelta).toBeCloseTo(1.01, 2);
    expect(region.longitudeDelta).toBeCloseTo(2.01, 2);
  });

  it('region latitude is between min and max', () => {
    const locations = [
      { latitude: 43.0, longitude: -80.0 },
      { latitude: 44.0, longitude: -78.0 },
    ];

    const region = computeRegion(locations, defaultLocation);

    expect(region.latitude).toBeGreaterThanOrEqual(43.0);
    expect(region.latitude).toBeLessThanOrEqual(44.0);
  });

  it('region longitude is between min and max', () => {
    const locations = [
      { latitude: 43.0, longitude: -80.0 },
      { latitude: 44.0, longitude: -78.0 },
    ];

    const region = computeRegion(locations, defaultLocation);

    expect(region.longitude).toBeGreaterThanOrEqual(-80.0);
    expect(region.longitude).toBeLessThanOrEqual(-78.0);
  });

  it('handles single coordinate', () => {
    const region = computeRegion([{ latitude: 51.5074, longitude: -0.1278 }], defaultLocation);

    expect(region.latitudeDelta).toBe(0.015);
    expect(region.longitudeDelta).toBe(0.0121);
  });

  it('correctly parses JSON bookmark locations', () => {
    const json = JSON.stringify([
      { latitude: 43.6532, longitude: -79.3832, name: 'Stop 1' },
      { latitude: 43.796, longitude: -79.3486, name: 'Stop 2' },
    ]);

    const parsed: Location[] = JSON.parse(json);
    const region = computeRegion(parsed, defaultLocation);

    expect(parsed.length).toBe(2);
    expect(region.latitude).toBeGreaterThan(43.65);
    expect(region.latitude).toBeLessThan(43.8);
  });
});
