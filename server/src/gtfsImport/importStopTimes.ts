import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

import { getDatabase, runTransaction } from '../db/database';

export async function importStopTimes() {
  const filePath = path.join(process.cwd(), 'gtfs', 'stop_times.txt');

  return new Promise<void>((resolve, reject) => {
    const rows: any[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', async () => {
        try {
          const database = await getDatabase();

          // Optional: clear table before re-import
          database.exec(`DELETE FROM gtfs_stop_times`);

          const stmt = database.prepare(`
            INSERT OR REPLACE INTO gtfs_stop_times (
              trip_id,
              arrival_time,
              departure_time,
              stop_id,
              stop_sequence,
              stop_headsign,
              pickup_type,
              drop_off_type,
              shape_dist_traveled,
              timepoint
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          await runTransaction(() => {
            for (const row of rows) {
              stmt.run(
                row.trip_id,
                row.arrival_time,
                row.departure_time,
                row.stop_id,
                row.stop_sequence,
                row.stop_headsign,
                row.pickup_type,
                row.drop_off_type,
                row.shape_dist_traveled,
                row.timepoint,
              );
            }
          });

          console.log('GTFS stop_times imported');
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}
