import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

import { getDatabase, runTransaction } from '../db/database';

export async function importShapes() {
  const filePath = path.join(process.cwd(), 'gtfs', 'shapes.txt');

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
          database.exec(`DELETE FROM gtfs_shapes`);

          const stmt = database.prepare(`
            INSERT OR REPLACE INTO gtfs_shapes (
              shape_id,
              shape_pt_lat,
              shape_pt_lon,
              shape_pt_sequence,
              shape_dist_traveled
            )
            VALUES (?, ?, ?, ?, ?)
          `);

          await runTransaction(() => {
            for (const row of rows) {
              stmt.run(
                row.shape_id,
                row.shape_pt_lat,
                row.shape_pt_lon,
                row.shape_pt_sequence,
                row.shape_dist_traveled,
              );
            }
          });

          console.log('GTFS shapes imported');
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}
