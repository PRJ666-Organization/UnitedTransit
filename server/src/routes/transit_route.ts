import { Router, Request, Response } from 'express';
import https from 'https';
import { runQuery } from '../db/database';

const router = Router();

function getApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}

// Cache for GTFS routes
let gtfsRoutesCache: Map<string, { shortName: string; longName: string; color: string; type: number }> | null = null;

async function loadGtfsRoutes(): Promise<Map<string, { shortName: string; longName: string; color: string; type: number }>> {
  if (gtfsRoutesCache) return gtfsRoutesCache;

  try {
    const routes = await runQuery(
      `SELECT route_id, route_short_name, route_long_name, route_type, route_color FROM gtfs_routes`
    );
    gtfsRoutesCache = new Map();
    for (const route of routes) {
      gtfsRoutesCache.set(route.route_short_name?.toLowerCase() || '', {
        shortName: route.route_short_name || '',
        longName: route.route_long_name || '',
        color: route.route_color ? `#${route.route_color}` : '#0a7ea4',
        type: route.route_type || 3, // Default to bus
      });
    }
    return gtfsRoutesCache;
  } catch (err) {
    console.error('[Transit Route] Failed to load GTFS routes:', err);
    return new Map();
  }
}

function getGtfsRouteInfo(
  shortName: string,
  gtfsRoutes: Map<string, { shortName: string; longName: string; color: string; type: number }>
): { shortName: string; longName: string; color: string; type: number } | null {
  const key = shortName?.toLowerCase() || '';
  return gtfsRoutes.get(key) || null;
}

function formatTimeHHMM(raw: string): string {
  const upper = raw.toUpperCase();
  let isPm = upper.includes('PM');
  const cleaned = raw.replace(/\s*(AM|PM)/i, '');
  const p = cleaned.split(':');
  if (p.length < 2) return raw;
  let h = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  if (!upper.includes('AM') && !upper.includes('PM') && h >= 12) {
    isPm = true;
  }
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${isPm ? 'pm' : 'am'}`;
}

function distStr(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

const TRANSIT_TYPES: Record<string, { icon: string; name: string }> = {
  BUS: { icon: '🚌', name: 'Bus' },
  RAIL: { icon: '🚆', name: 'Rail' },
  SUBWAY: { icon: '🚇', name: 'Subway' },
  SUBWAY_TRAIN: { icon: '🚇', name: 'Subway' },
  METRO: { icon: '🚇', name: 'Metro' },
  TRAM: { icon: '🚋', name: 'Streetcar' },
  TROLLEYBUS: { icon: '🚌', name: 'Trolleybus' },
  TROLLEY_BUS: { icon: '🚌', name: 'Trolleybus' },
  FERRY: { icon: '⛴️', name: 'Ferry' },
  HEAVY_RAIL: { icon: '🚆', name: 'Train' },
  METRO_RAIL: { icon: '🚇', name: 'Metro' },
  COMMUTER_TRAIN: { icon: '🚆', name: 'Commuter' },
  HIGH_SPEED_TRAIN: { icon: '🚆', name: 'High Speed' },
};

function transitInfo(type: string) {
  return TRANSIT_TYPES[type] || TRANSIT_TYPES.BUS;
}

function fetchGoogle(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

interface Step {
  mode: 'WALKING' | 'TRANSIT';
  instruction: string;
  distance: string;
  duration: string;
  transitLine?: { name: string; shortName: string; color: string; icon: string };
  from?: string;
  to?: string;
  numStops?: number;
  polyline?: string; // Encoded polyline for this step
  departureTime?: string;
  arrivalTime?: string;
}

interface Leg {
  steps: Step[];
  duration: string;
  distance: string;
  departureTime?: string;
  arrivalTime?: string;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const apiKey = getApiKey();
    console.log(`[Transit Route] apiKey loaded: ${!!apiKey} (${apiKey ? apiKey.substring(0, 10) + '...' : 'none'})`);
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const [oLat, oLon] = (req.query.origin as string).split(',').map(Number);
    const [dLat, dLon] = (req.query.destination as string).split(',').map(Number);

    if ([oLat, oLon, dLat, dLon].some(isNaN)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const departureTime = Math.floor(Date.now() / 1000);
    const base = `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${oLat},${oLon}` +
      `&destination=${dLat},${dLon}` +
      `&mode=transit` +
      `&departure_time=${departureTime}`;

    // Query multiple transit modes to get comprehensive results
    const transitModes = ['bus', 'subway', 'train', 'tram', 'rail'];
    const transitPrefs = ['less_walking', 'fewer_transfers'];
    const allRawRoutes: any[] = [];
    const seenSignatures = new Set<string>();

    // Load GTFS routes for enrichment
    const gtfsRoutes = await loadGtfsRoutes();
    console.log(`[Transit Route] Loaded ${gtfsRoutes.size} GTFS routes`);

    // Also query without specific mode to get "best" routes
    const modeQueries = ['', ...transitModes];

    for (const mode of modeQueries) {
      for (const pref of transitPrefs) {
        try {
          const modeParam = mode ? `&transit_mode=${mode}` : '';
          const reqUrl = `${base}${modeParam}&transit_routing_preference=${pref}&key=${apiKey}`;
          const raw = await fetchGoogle(reqUrl);
          const parsed = JSON.parse(raw.toString());

          if (parsed.status === 'OK' && parsed.routes?.length) {
            for (const r of parsed.routes) {
              // Create signature based on transit line identifiers
              const transitSteps = r.legs?.[0]?.steps
                ?.filter((s: any) => s.travel_mode === 'TRANSIT')
                ?.map((s: any) => {
                  const line = s.transit?.line;
                  const type = line?.vehicle?.type || 'BUS';
                  const shortName = line?.short_name || line?.name || '';
                  return `${type}:${shortName}`;
                }) || [];

              const key = transitSteps.join('|');
              const modes = r.legs?.[0]?.steps
                ?.filter((s: any) => s.travel_mode === 'TRANSIT')
                ?.map((s: any) => s.transit?.line?.vehicle?.type)
                ?.join(',') || '';

              console.log(`[Transit Route] mode=${mode || 'any'} pref=${pref} summary="${r.summary}" types=${modes} key=${key}`);

              if (!seenSignatures.has(key)) {
                seenSignatures.add(key);
                allRawRoutes.push(r);
              }
            }
          }
        } catch (err) {
          console.error(`[Transit Route] mode=${mode || 'any'} pref=${pref} failed:`, err);
        }
      }
    }

    if (allRawRoutes.length === 0) {
      return res.status(404).json({ error: 'No transit routes found' });
    }

    console.log(`[Transit Route] Combined ${allRawRoutes.length} unique route(s)`);

    const buildLegs = (route: any): Leg[] => {
      const legs: Leg[] = [];
      for (const leg of route.legs) {
        const steps: Step[] = [];
        let totalDistance = 0;

        for (const step of leg.steps) {
          const durationMin = Math.max(1, Math.round(step.duration.value / 60));
          totalDistance += step.distance.value;

          if (step.travel_mode === 'WALKING') {
            steps.push({
              mode: 'WALKING',
              instruction: step.html_instructions
                ?.replace(/<[^>]*>/g, '')
                ?.replace(/&[^;]*;/g, ' ') || 'Walk',
              distance: distStr(step.distance.value),
              duration: `${durationMin} min`,
              polyline: step.polyline?.points,
            });
          } else if (step.travel_mode === 'TRANSIT') {
            // Google Maps API uses 'transit_details' (with underscore)
            const transitData = step.transit_details || {};
            const line = transitData.line || {};

            const vehicleType = line.vehicle?.type || 'BUS';
            const info = transitInfo(vehicleType);
            let shortName = line.short_name || '';
            const longName = line.name || '';
            let colorHex = line.color || '#0a7ea4';

            // Get stop names
            const departureStop = transitData.departure_stop?.name || '';
            const arrivalStop = transitData.arrival_stop?.name || '';
            const numStops = transitData.num_stops;

            // Get departure/arrival times for this step
            const stepDepTime = transitData.departure_time?.text;
            const stepArrTime = transitData.arrival_time?.text;

            // Get agency info
            const agency = line.agencies?.[0] || {};
            const agencyName = agency.name || '';

            // Try to enrich with GTFS data if Google data is missing
            if (!shortName || colorHex === '#0a7ea4') {
              const lookupName = shortName || longName?.split(/[,-]/)[0]?.trim() || '';
              const gtfsInfo = getGtfsRouteInfo(lookupName, gtfsRoutes);

              if (gtfsInfo) {
                if (!shortName && gtfsInfo.shortName) {
                  shortName = gtfsInfo.shortName;
                }
                if (colorHex === '#0a7ea4' && gtfsInfo.color) {
                  colorHex = gtfsInfo.color;
                }
              }
            }

            // Log what we extracted
            console.log(`[Transit Route] Line data:`, {
              shortName,
              longName,
              vehicleType,
              color: colorHex,
              departureTime: stepDepTime,
              agencyName,
              departureStop,
              arrivalStop,
            });

            // Try to extract route number from longName if shortName is empty
            if (!shortName && longName) {
              const routeMatch = longName.match(/(?:Route\s+|Line\s+)?(\d+[A-Za-z]?)/i);
              if (routeMatch) {
                shortName = routeMatch[1];
              } else {
                shortName = longName.split(/[-,]/)[0].trim();
              }
            }

            if (!shortName && agencyName) {
              shortName = agencyName;
            }

            // Build clear instruction
            let instruction = '';
            if (shortName) {
              instruction = `${info.name} ${shortName}`;
            } else if (longName) {
              instruction = `${info.name} (${longName.split(',')[0]})`;
            } else {
              instruction = info.name;
            }

            steps.push({
              mode: 'TRANSIT',
              instruction,
              distance: '',
              duration: `${durationMin} min`,
              transitLine: {
                name: longName,
                shortName: shortName || longName.split(',')[0] || info.name,
                color: colorHex,
                icon: info.icon,
              },
              from: departureStop || undefined,
              to: arrivalStop || undefined,
              numStops: numStops,
              polyline: step.polyline?.points,
              departureTime: stepDepTime ? formatTimeHHMM(stepDepTime) : undefined,
              arrivalTime: stepArrTime ? formatTimeHHMM(stepArrTime) : undefined,
            });
          }
        }

        const depStr = leg.departure_time?.text;
        const arrStr = leg.arrival_time?.text;

        legs.push({
          steps,
          duration: `${Math.round(leg.duration.value / 60)} min`,
          distance: distStr(totalDistance),
          departureTime: depStr ? formatTimeHHMM(depStr) : undefined,
          arrivalTime: arrStr ? formatTimeHHMM(arrStr) : undefined,
        });
      }
      return legs;
    };

    const allRoutes: { summary: string; legs: Leg[] }[] = allRawRoutes.map((route) => ({
      summary: route.summary || '',
      legs: buildLegs(route),
    }));

    // Sort by duration
    allRoutes.sort((a, b) => {
      const durA = parseInt(a.legs[0]?.duration || '999');
      const durB = parseInt(b.legs[0]?.duration || '999');
      return durA - durB;
    });

    res.json({ routes: allRoutes });
  } catch (err) {
    console.error('[Transit Route] GET failed:', err);
    res.status(500).json({ error: 'Failed to find route' });
  }
});

export default router;
