import { importRoutes } from './importRoutes';
import { importShapes } from './importShapes';
import { importStops } from './importStops';
import { importStopTimes } from './importStopTimes';
import { importTrips } from './importTrips';

async function importAll() {
  try {
    await importStops();
    await importRoutes();
    await importTrips();
    await importStopTimes();
    await importShapes();

    console.log('All GTFS data imported');
  } catch (error) {
    console.error(error);
  }
}

importAll();
