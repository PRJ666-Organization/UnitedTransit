import { downloadGtfs } from './downloadGTFS';
import { importAll } from './importAll';

async function setupGtfs() {
  try {
    await downloadGtfs();
    await importAll();

    console.log('GTFS setup complete');
  } catch (error) {
    console.error(error);
  }
}

setupGtfs();
