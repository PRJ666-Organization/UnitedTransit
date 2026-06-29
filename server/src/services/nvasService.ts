import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const VEHICLE_URL = 'https://bustime.ttc.ca/gtfsrt/vehicles';

export interface LiveVehicle {
  vehicleId: string;
  routeId?: string;
  tripId?: string;
  stopId?: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  hasAssignment: boolean;
}

let cache: LiveVehicle[] = [];
let lastFetch = 0;
const CACHE_MS = 30000;

async function fetchFeed() {
  const res = await fetch(VEHICLE_URL);

  if (!res.ok) {
    throw new Error(`Failed TTC feed: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
}

export async function getAllVehicles(): Promise<LiveVehicle[]> {
  const now = Date.now();

  if (now - lastFetch < CACHE_MS) {
    return cache;
  }

  const feed = await fetchFeed();

  cache = feed.entity
    .filter((e: any) => e.vehicle)
    .map((e: any) => {
      const v = e.vehicle;

      return {
        vehicleId: v.vehicle?.id,
        routeId: v.trip?.routeId,
        tripId: v.trip?.tripId,
        stopId: v.stopId,
        latitude: v.position?.latitude,
        longitude: v.position?.longitude,
        bearing: v.position?.bearing,
        speed: v.position?.speed,
        hasAssignment: !!v.trip?.routeId,
      };
    });

  lastFetch = now;

  return cache;
}

export async function getVehiclesByRoute(routeId: string) {
  const vehicles = await getAllVehicles();

  const baseRoute = routeId.replace(/[A-Z]/g, '');

  return vehicles.filter((v) => {
    if (!v.routeId) return false;

    return v.routeId === baseRoute;
  });
}

export async function getVehiclesByTrip(tripId: string) {
  const vehicles = await getAllVehicles();

  return vehicles.filter((v) => v.tripId === tripId);
}
