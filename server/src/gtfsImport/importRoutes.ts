import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

import { runMutation } from '../db/database';

export async function importRoutes() {
  const filePath = path.join(process.cwd(), 'gtfs', 'routes.txt');

  return new Promise<void>((resolve, reject) => {
    const rows: any[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', async () => {
        try {
          await runMutation(`DELETE FROM gtfs_routes`);
          for (const row of rows) {
            await runMutation(
              `
              INSERT OR REPLACE INTO gtfs_routes (
                route_id,
                agency_id,
                route_short_name,
                route_long_name,
                route_type,
                route_color,
                route_text_color
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              [
                row.route_id,
                row.agency_id,
                row.route_short_name,
                row.route_long_name,
                row.route_type,
                row.route_color,
                row.route_text_color,
              ],
            );
          }

          console.log('GTFS routes imported');
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}
