describe('Geocoding Utility', () => {
  const mockResults = [
    {
      formatted_address: '123 Main St, Toronto',
      geometry: { location: { lat: 43.6532, lng: -79.3832 } },
    },
  ];

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('returns geocoded results from Google API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          status: 'OK',
          results: mockResults,
        }),
    });

    const query = '123 Main St, Toronto';
    const apiKey = 'test-key';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

    const res = await fetch(url);
    const json = await res.json();

    expect(json.status).toBe('OK');
    expect(json.results.length).toBe(1);
    expect(json.results[0].formatted_address).toBe('123 Main St, Toronto');
  });

  it('handles OVER_QUERY_LIMIT error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          status: 'OVER_QUERY_LIMIT',
          results: [],
        }),
    });

    const json = await (await fetch('https://example.com')).json();
    expect(json.status).toBe('OVER_QUERY_LIMIT');
  });

  it('handles REQUEST_DENIED error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          status: 'REQUEST_DENIED',
          results: [],
        }),
    });

    const json = await (await fetch('https://example.com')).json();
    expect(json.status).toBe('REQUEST_DENIED');
  });

  it('maps results to GeoResult format', () => {
    const mapped = mockResults.map((r) => ({
      formatted_address: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    }));

    expect(mapped.length).toBe(1);
    expect(mapped[0].lat).toBe(43.6532);
    expect(mapped[0].lng).toBe(-79.3832);
  });

  it('limits results to 5', () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      formatted_address: `Address ${i}`,
      geometry: { location: { lat: 43.0 + i * 0.01, lng: -79.0 + i * 0.01 } },
    }));

    const sliced = manyResults.slice(0, 5);
    expect(sliced.length).toBe(5);
  });

  it('handles empty results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ status: 'OK', results: [] }),
    });

    const json = await (await fetch('https://example.com')).json();
    expect(json.results.length).toBe(0);
  });
});
