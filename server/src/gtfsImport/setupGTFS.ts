import fs from 'fs';
import path from 'path';
import { downloadGtfs } from './downloadGTFS';
import { importAll } from './importAll';

const REQUIRED_GTFS_FILES = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'];

function gtfsFilesExist(): boolean {
  const gtfsDir = path.join(process.cwd(), 'gtfs');
  return REQUIRED_GTFS_FILES.every((f) => fs.existsSync(path.join(gtfsDir, f)));
}

export async function setupGtfs() {
  try {
    if (!gtfsFilesExist()) {
      await downloadGtfs();
    } else {
      console.log('GTFS files already present, skipping download');
    }

    await importAll();
    console.log('GTFS setup complete');
  } catch (error) {
    console.error('GTFS setup failed:', error);
  }
}
