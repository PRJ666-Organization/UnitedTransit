import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

import { runMutation } from '../db/database';

export async function importTrips() {
  const filePath = path.join(process.cwd(), 'gtfs', 'trips.txt');

  return new Promise<void>((resolve, reject) => {
    const rows: any[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', async () => {
        try {
          for (const row of rows) {
            await runMutation(
              `
              INSERT OR REPLACE INTO gtfs_trips (
                trip_id,
                route_id,
                service_id,
                trip_headsign,
                trip_short_name,
                direction_id,
                block_id,
                shape_id,
                wheelchair_accessible
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                row.trip_id,
                row.route_id,
                row.service_id,
                row.trip_headsign,
                row.trip_short_name,
                row.direction_id,
                row.block_id,
                row.shape_id,
                row.wheelchair_accessible,
              ],
            );
          }

          console.log('GTFS trips imported');
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}
