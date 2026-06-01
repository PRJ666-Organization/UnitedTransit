import { Router, Request, Response } from 'express';
import https from 'https';

const router = Router();

function getApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
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
  SUBWAY_TRAIN: { icon: '🚇', name: 'Subway' },
  TRAM: { icon: '🚋', name: 'Streetcar' },
  TROLLEYBUS: { icon: '🚌', name: 'Trolleybus' },
  TROLLEY_BUS: { icon: '🚌', name: 'Trolleybus' },
  FERRY: { icon: '⛴️', name: 'Ferry' },
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

    const transitModes = ['any', 'subway', 'train', 'rail', 'bus', 'tram'];
    const transitPrefs = ['less_walking', 'fewer_transfers'];
    const allRawRoutes: any[] = [];
    const seenSignatures = new Set<string>();

    for (const mode of transitModes) {
      for (const pref of transitPrefs) {
        try {
          const reqUrl = `${base}&transit_mode=${mode}&transit_routing_preference=${pref}&key=${apiKey}`;
          const raw = await fetchGoogle(reqUrl);
          const parsed = JSON.parse(raw.toString());

          if (parsed.status === 'OK' && parsed.routes?.length) {
            for (const r of parsed.routes) {
              const transitSteps = r.legs?.[0]?.steps
                .filter((s: any) => s.travel_mode === 'TRANSIT')
                .map((s: any) => `${s.transit?.line?.vehicle?.type}(${s.transit?.line?.short_name})`)
                .join(',') || 'none';

              const key = `${transitSteps}`;
              const modes = r.legs?.[0]?.steps
                .filter((s: any) => s.travel_mode === 'TRANSIT')
                .map((s: any) => s.transit?.line?.vehicle?.type)
                .join(',') || '';

              console.log(`[Transit Route] mode=${mode} pref=${pref} summary="${r.summary}" types=${modes} transit=${transitSteps}`);

              if (!seenSignatures.has(key)) {
                seenSignatures.add(key);
                allRawRoutes.push(r);
              }
            }
          }
        } catch (err) {
          console.error(`[Transit Route] mode=${mode} pref=${pref} failed:`, err);
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
                .replace(/<[^>]*>/g, '')
                .replace(/&[^;]*;/g, ' '),
              distance: distStr(step.distance.value),
              duration: `${durationMin} min`,
            });
          } else if (step.travel_mode === 'TRANSIT') {
            const info = transitInfo(step.transit?.line?.vehicle?.type || 'BUS');
            const shortName = step.transit?.line?.short_name || '';
            const longName = step.transit?.line?.name || '';
            const colorHex = step.transit?.line?.color
              ? `#${step.transit.line.color}`
              : '#0a7ea4';

            const fromStop = step.start_location
              ? `${step.start_location.lat.toFixed(4)}, ${step.start_location.lng.toFixed(4)}`
              : undefined;
            const toStop = step.end_location
              ? `${step.end_location.lat.toFixed(4)}, ${step.end_location.lng.toFixed(4)}`
              : undefined;

            steps.push({
              mode: 'TRANSIT',
              instruction: `${info.name} ${shortName}`.trim(),
              distance: '',
              duration: `${durationMin} min`,
              transitLine: {
                name: longName,
                shortName: shortName,
                color: colorHex,
                icon: info.icon,
              },
              from: fromStop,
              to: toStop,
            });
          } else if (step.travel_mode === 'BICYCLING') {
            steps.push({
              mode: 'WALKING',
              instruction: step.html_instructions
                .replace(/<[^>]*>/g, '')
                .replace(/&[^;]*;/g, ' '),
              distance: distStr(step.distance.value),
              duration: `${durationMin} min`,
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
