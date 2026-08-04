// One-time PNG generation from the app mark. Run: npm run icons
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

// rx > 0 → standalone icon with rounded corners (transparent outside).
// rx = 0 → full-bleed square for maskable/apple, which get masked by the OS.
const mark = (rx) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rx}" fill="#161826"/>
  <circle cx="256" cy="256" r="138" fill="none" stroke="#9184d9" stroke-opacity="0.14" stroke-width="30"/>
  <circle cx="256" cy="256" r="120" fill="none" stroke="#9184d9" stroke-width="13"/>
  <path d="M256 206v100M206 256h100" stroke="#9184d9" stroke-width="13" stroke-linecap="round"/>
</svg>`

const out = new URL('../public/icons/', import.meta.url).pathname
await mkdir(out, { recursive: true })

const jobs = [
  { file: 'icon-192.png', rx: 43, size: 192 },
  { file: 'icon-512.png', rx: 115, size: 512 },
  { file: 'icon-512-maskable.png', rx: 0, size: 512 },
  { file: 'apple-touch-icon.png', rx: 0, size: 180 },
]

for (const { file, rx, size } of jobs) {
  await sharp(Buffer.from(mark(rx))).resize(size, size).png().toFile(out + file)
  console.log('wrote', file)
}
