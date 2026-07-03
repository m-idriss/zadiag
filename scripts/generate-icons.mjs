import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../public/icons/icon.svg', import.meta.url));
const toIconPath = (name) => fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url));

await Promise.all(
  [192, 512].map((size) => sharp(source).resize(size, size).png().toFile(toIconPath(`icon-${size}.png`))),
);

const maskableSize = 512;
const maskableForeground = await sharp(source)
  .resize(Math.round(maskableSize * 0.8), Math.round(maskableSize * 0.8))
  .png()
  .toBuffer();

await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: '#010a17',
  },
})
  .composite([{ input: maskableForeground, gravity: 'center' }])
  .png()
  .toFile(toIconPath('icon-maskable-512.png'));
