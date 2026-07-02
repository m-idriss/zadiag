import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const assetsDirectory = resolve('dist/assets');
const files = await readdir(assetsDirectory);
const javascript = files.filter((file) => file.endsWith('.js'));
const sizes = await Promise.all(javascript.map(async (file) => ({ file, bytes: (await stat(resolve(assetsDirectory, file))).size })));
const total = sizes.reduce((sum, asset) => sum + asset.bytes, 0);
const maximumTotalBytes = 2_200_000;

if (total > maximumTotalBytes) {
  throw new Error(`JavaScript bundle is ${total} bytes; limit is ${maximumTotalBytes} bytes.`);
}

const largest = sizes.toSorted((left, right) => right.bytes - left.bytes)[0];
console.log(`JavaScript bundle: ${total} bytes across ${sizes.length} chunks; largest: ${largest?.file ?? 'none'} (${largest?.bytes ?? 0} bytes).`);
