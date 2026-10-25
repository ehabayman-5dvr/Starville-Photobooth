// Explicit live verification: incurs one Flare generation, upload and metrics increment.
// Never invoked by npm test or build.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const selfie = await sharp('Generation-Reference/The Boss/Teal-Hued StarVille Studio Selfie.png').resize(720, 1280).jpeg({ quality: 90 }).toBuffer();
const started = Date.now();
const origin = process.env.BOOTH_TEST_ORIGIN || 'http://localhost:5173';
const response = await fetch(`${origin}/api/generate`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ mode: 'explorer', variation: 0, image: `data:image/jpeg;base64,${selfie.toString('base64')}` }),
  signal: AbortSignal.timeout(295_000),
});
const result = await response.json();
if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.error}`);
if (result.preview) throw new Error('Local preview is enabled; this was not a live generation.');
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/live-result.jpg', Buffer.from(result.image.split(',')[1], 'base64'));
const summary = { id: result.id, seconds: Math.round((Date.now() - started) / 1000), hosted: !!result.hostedUrl, archiveFailed: result.archiveFailed };
await writeFile('artifacts/live-result.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
