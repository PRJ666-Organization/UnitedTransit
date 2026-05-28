//Just for testing that the gtfs import is working can remove later

import { runQuery } from './db/database';

async function test() {
  const stops = await runQuery(`
    SELECT *
    FROM gtfs_stops
    LIMIT 5
  `);

  console.log(stops);

  const routes = await runQuery(`
    SELECT *
    FROM gtfs_routes
    LIMIT 5
  `);

  console.log(routes);
}

test();
