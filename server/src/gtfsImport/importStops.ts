import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

import { runMutation } from '../db/database';

export async function importStops() {
  const filePath = path.join(process.cwd(), 'gtfs', 'stops.txt');

  return new Promise<void>((resolve, reject) => {
    const rows: any[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', async () => {
        try {
          await runMutation(`DELETE FROM gtfs_stops`);
          for (const row of rows) {
            await runMutation(
              `
              INSERT OR REPLACE INTO gtfs_stops (
                stop_id,
                stop_code,
                stop_name,
                stop_desc,
                stop_lat,
                stop_lon,
                zone_id,
                stop_url,
                location_type,
                parent_station,
                stop_timezone,
                wheelchair_boarding,
                level_id
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                row.stop_id,
                row.stop_code,
                row.stop_name,
                row.stop_desc,
                row.stop_lat,
                row.stop_lon,
                row.zone_id,
                row.stop_url,
                row.location_type,
                row.parent_station,
                row.stop_timezone,
                row.wheelchair_boarding,
                row.level_id,
              ],
            );
          }

          console.log('GTFS stops imported');
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}
