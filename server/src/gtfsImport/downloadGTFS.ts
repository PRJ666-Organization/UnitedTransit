import fs from 'fs';
import https from 'https';
import path from 'path';
import unzipper from 'unzipper';

const packageId = 'b811ead4-6eaf-4adb-8408-d389fb5a069c';

export async function downloadGtfs() {
  const gtfsDir = path.join(process.cwd(), 'gtfs');

  if (!fs.existsSync(gtfsDir)) {
    fs.mkdirSync(gtfsDir, { recursive: true });
  }

  console.log('Fetching TTC GTFS metadata...');

  const pkg: any = await new Promise((resolve, reject) => {
    https.get(
      `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=${packageId}`,
      (response) => {
        const chunks: Buffer[] = [];

        response
          .on('data', (chunk) => {
            chunks.push(chunk);
          })
          .on('end', () => {
            try {
              const data = Buffer.concat(chunks);
              const json = JSON.parse(data.toString());
              resolve(json.result);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      },
    );
  });

  const zipResource = pkg.resources.find((resource: any) => {
    return resource.format?.toLowerCase() === 'zip' || resource.url?.includes('.zip');
  });

  if (!zipResource) {
    throw new Error('Could not find GTFS ZIP resource');
  }

  const zipUrl = zipResource.url;

  console.log('Downloading GTFS ZIP...');
  console.log(zipUrl);

  const zipPath = path.join(gtfsDir, 'ttc_gtfs.zip');

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);

    https
      .get(zipUrl, (response) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', reject);
  });

  console.log('Extracting GTFS ZIP...');

  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: gtfsDir }))
    .promise();

  console.log('GTFS download complete');
}
