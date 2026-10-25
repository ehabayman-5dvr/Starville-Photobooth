import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { modes, buildPrompt } from '../shared/modes.mjs';
import { logGenerationPrompt } from '../shared/logPrompt.mjs';

const ROOT = process.cwd();
export class BoothError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function validateInput(body) {
  if (!body || !Object.hasOwn(modes, body.mode) || !Number.isInteger(body.variation) || body.variation < 0 || body.variation > 2) {
    throw new BoothError('Please choose a mode and try again.');
  }
  if (typeof body.image !== 'string' || body.image.length > 3_000_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image)) {
    throw new BoothError('Please take a new photo and try again.');
  }
  return { mode: body.mode, variation: body.variation, image: Buffer.from(body.image.split(',')[1], 'base64') };
}

export async function composeLogo(image) {
  const normalized = await sharp(image, { limitInputPixels: 25_000_000 }).rotate().resize(1080, 1920, { fit: 'cover' }).toBuffer();
  const logo = await sharp(path.join(ROOT, 'StarVille-Logo.png')).resize({ width: 440 }).toBuffer();
  return sharp(normalized).composite([{ input: logo, left: 320, top: 230 }]).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function incrementMetrics(mode, variation, { env = process.env, fetcher = fetch } = {}) {
  const endpoint = env.METRICS_API_URL;
  if (!endpoint) return;
  try {
    const response = await fetcher(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetName: modes[mode].name, provider: 'openai', variation: modes[mode].variations[variation].name, timestamp: Date.now() }),
      signal: AbortSignal.timeout(4000),
    });
    console.info(response.ok ? '[Metrics] Generation counted.' : `[Metrics] Count failed: HTTP ${response.status}.`);
  } catch { console.warn('[Metrics] Count unavailable; no automatic retry.'); }
}

export async function uploadPhoto(image, id, { env = process.env, fetcher = fetch, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const key = env.CLOUDINARY_API_KEY;
  const secret = env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) throw new BoothError('Photo storage is not configured.', 503);
  const folder = env.CLOUDINARY_FOLDER || 'Starville-Photobooth';
  const timestamp = String(Math.floor(Date.now() / 1000));
  // A stable public_id makes upload retries overwrite the same photo.
  const params = { folder, public_id: id, timestamp };
  const signed = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const signature = createHash('sha1').update(signed + secret).digest('hex');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const form = new FormData();
      for (const [k, v] of Object.entries(params)) form.append(k, v);
      form.append('api_key', key); form.append('signature', signature);
      form.append('file', new Blob([image], { type: 'image/jpeg' }), `${id}.jpg`);
      const response = await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error('Upload failed.');
      const result = await response.json();
      if (typeof result.secure_url !== 'string' || !result.secure_url.startsWith('https://res.cloudinary.com/')) throw new Error('Missing hosted image.');
      return result.secure_url;
    } catch {
      if (attempt === 2) throw new BoothError('Photo storage is temporarily unavailable.', 502);
      await delay(2 ** (attempt + 1) * 1000);
    }
  }
}

export async function generatePhoto(body, { env = process.env, fetcher = fetch, schedule = p => { void p; }, preview = false, upload = uploadPhoto } = {}) {
  const input = validateInput(body);
  let metadata;
  try { metadata = await sharp(input.image, { limitInputPixels: 16_000_000 }).metadata(); }
  catch { throw new BoothError('This photo could not be read. Please take it again.'); }
  if (metadata.format !== 'jpeg' || metadata.width < 200 || metadata.height < 200) throw new BoothError('Please take a larger, clearer photo.');
  const id = randomUUID();
  const variation = modes[input.mode].variations[input.variation];
  const prompt = buildPrompt(input.mode, input.variation);
  const promptDetails = { id, prompt, mode: modes[input.mode].name, variation: `${input.variation + 1}/3 · ${variation.name}` };
  let output;
  if (preview) {
    logGenerationPrompt({ ...promptDetails, preview: true, quality: 'Local sample' });
    output = await readFile(path.join(ROOT, 'Generation-Reference', variation.file));
  } else {
    if (!env.OPENAI_API_KEY) throw new BoothError('Generation is not configured yet. Please try again later.', 503);
    const form = new FormData();
    form.append('model', 'gpt-image-2.5-flare');
    form.append('prompt', prompt);
    form.append('size', '1008x1792');
    form.append('quality', ['low', 'medium', 'high', 'xhigh', 'max', 'auto'].includes(env.OPENAI_QUALITY) ? env.OPENAI_QUALITY : 'high');
    form.append('output_format', 'jpeg');
    form.append('output_compression', '92');
    form.append('n', '1');
    form.append('image[]', new Blob([input.image], { type: 'image/jpeg' }), 'participant.jpg');
    let response;
    try {
      // Never retry paid generation automatically, including ambiguous timeouts.
      logGenerationPrompt({ ...promptDetails, quality: String(form.get('quality')) });
      response = await fetcher('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(220_000) });
    } catch { throw new BoothError('The generation connection was interrupted. Please try again when you are ready.', 504); }
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const detail = response.status === 401 ? 'Configured provider credential was rejected.' : String(failure.error?.message || '').replaceAll(env.OPENAI_API_KEY, '[redacted]').replace(/sk-[\w-]+/g, '[redacted]').slice(0, 500);
      console.warn('[Generation] Provider rejected request:', JSON.stringify({ status: response.status, code: failure.error?.code, type: failure.error?.type, detail }));
      if (response.status === 401 || response.status === 403) throw new BoothError('The studio is temporarily unavailable. Please try again later.', 503);
      throw new BoothError(response.status === 429 ? 'The studio is busy. Please wait a moment and try again.' : 'We could not create this portrait. Please try again or take a new photo.', response.status === 429 ? 429 : 502);
    }
    const result = await response.json();
    const encoded = result.data?.[0]?.b64_json;
    if (typeof encoded !== 'string' || !encoded.length) throw new BoothError('The studio returned no photo. Please try again.', 502);
    output = Buffer.from(encoded, 'base64');
    schedule(incrementMetrics(input.mode, input.variation, { env, fetcher }));
  }
  const branded = await composeLogo(output);
  let hostedUrl = null;
  if (!preview) {
    try { hostedUrl = await upload(branded, id, { env, fetcher }); }
    catch { console.warn('[Cloudinary] Archive failed. Branded download remains available.'); }
  }
  return { id, image: `data:image/jpeg;base64,${branded.toString('base64')}`, hostedUrl, mode: input.mode, variation: input.variation, preview, archiveFailed: !preview && !hostedUrl };
}
