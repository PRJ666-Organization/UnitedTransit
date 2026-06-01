import { importRoutes } from './importRoutes';
import { importShapes } from './importShapes';
import { importStops } from './importStops';
import { importStopTimes } from './importStopTimes';
import { importTrips } from './importTrips';

export async function importAll() {
  console.log('Starting GTFS imports...');

  await importStops();
  await importRoutes();
  await importTrips();
  await importStopTimes();
  await importShapes();

  console.log('All GTFS imports complete');
}
