import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { buildPrompt, modes } from '../shared/modes.mjs';
import { composeLogo, generatePhoto, uploadPhoto, validateInput, incrementMetrics } from '../server/photobooth.mjs';
import handler from '../api/generate.mjs';

// Expected provider/metrics logs are noisy in lifecycle tests. Logging has its
// own tests; keep large prompt entries out of Node 22's test-worker IPC stream.
mock.method(console, 'info', () => {});
mock.method(console, 'warn', () => {});

const inputBytes = await sharp({ create: { width: 400, height: 700, channels: 3, background: '#e8c6b0' } }).jpeg().toBuffer();
const image = `data:image/jpeg;base64,${inputBytes.toString('base64')}`;
const body = { mode: 'boss', variation: 0, image };
const env = { OPENAI_API_KEY: 'test-key', CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret', CLOUDINARY_FOLDER: 'Starville-Photobooth', METRICS_API_URL: 'https://metrics.example/generate' };

test('each mode has three paired scene/outfit references and identity-safe prompts', async () => {
  for (const [mode, config] of Object.entries(modes)) {
    assert.equal(config.variations.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.ok((await readFile(`Generation-Reference/${config.variations[i].file}`)).length > 0);
      const prompt = buildPrompt(mode, i);
      assert.match(prompt, /ONLY source of personal identity/);
      assert.match(prompt, /Do not add a headcover/);
      assert.match(prompt, /Do not render ANY text/);
      assert.ok(prompt.includes(config.variations[i].scene));
      assert.match(prompt, /LIGHTING: .+\nCOLOR PALETTE: .+\nCOMPOSITION: .+/);
      assert.doesNotMatch(prompt, /IMAGE [12]|reference model|scene-reference/);
    }
  }
});

test('rejects unknown modes, prototype names, invalid variations and oversized payloads', () => {
  for (const invalid of [{ ...body, mode: '__proto__' }, { ...body, mode: 'constructor' }, { ...body, mode: 'other' }, { ...body, variation: 3 }, { ...body, variation: -1 }, { ...body, variation: '0' }, { ...body, image: 'data:image/png;base64,AAAA' }, { ...body, image: 'x'.repeat(3_000_001) }]) assert.throws(() => validateInput(invalid));
  assert.equal(validateInput(body).mode, 'boss');
});

test('composites the exact supplied logo into the exported 1080x1920 JPEG', async () => {
  const photo = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: '#fff' } }).png().toBuffer();
  const output = await composeLogo(photo);
  const meta = await sharp(output).metadata();
  assert.equal(meta.width, 1080); assert.equal(meta.height, 1920); assert.equal(meta.format, 'jpeg');
  const expectedLogo = await sharp('StarVille-Logo.png').resize({ width: 440 }).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const actual = await sharp(output).extract({ left: 320, top: 230, width: 440, height: expectedLogo.info.height }).removeAlpha().raw().toBuffer();
  const meanDifference = actual.reduce((sum, value, i) => sum + Math.abs(value - expectedLogo.data[i]), 0) / actual.length;
  assert.ok(meanDifference < 8, `Logo pixel difference ${meanDifference}`);
});

test('Flare request sends only the participant selfie with text scene instructions and counts once', async () => {
  const calls = [], scheduled = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return url.includes('api.openai.com') ? new Response(JSON.stringify({ data: [{ b64_json: inputBytes.toString('base64') }] }), { status: 200 }) : new Response('{}', { status: 200 });
  };
  const result = await generatePhoto(body, { env, fetcher, schedule: p => scheduled.push(p), upload: async () => 'https://res.cloudinary.com/test/image/upload/result.jpg' });
  await Promise.all(scheduled);
  assert.equal(calls.length, 2);
  const form = calls[0].options.body;
  assert.equal(form.get('model'), 'gpt-image-2.5-flare');
  assert.equal(form.get('size'), '1008x1792');
  assert.equal(form.get('n'), '1');
  assert.equal(form.has('input_fidelity'), false);
  assert.equal(form.getAll('image[]')[0].name, 'participant.jpg');
  const files = [...form.values()].filter(value => value instanceof Blob);
  assert.equal(files.length, 1, 'No scene reference or other image may be sent to Flare');
  assert.deepEqual(Buffer.from(await files[0].arrayBuffer()), inputBytes);
  assert.equal(form.get('prompt'), buildPrompt('boss', 0));
  assert.match(result.image, /^data:image\/jpeg;base64,/);
  assert.equal(result.archiveFailed, false);
  assert.equal(JSON.parse(calls[1].options.body).presetName, 'The Boss');
});

test('paid generation is never retried and failed/missing output is never counted', async () => {
  for (const scenario of ['http', 'network', 'missing']) {
    let count = 0; const scheduled = [];
    const fetcher = async () => {
      count++;
      if (scenario === 'network') throw new Error('interrupted');
      return scenario === 'http' ? new Response('{}', { status: 429 }) : new Response('{"data":[]}', { status: 200 });
    };
    await assert.rejects(generatePhoto(body, { env, fetcher, schedule: p => scheduled.push(p) }));
    assert.equal(count, 1); assert.equal(scheduled.length, 0);
  }
});

test('a storage failure preserves the branded downloadable photo and counts generation once', async () => {
  const scheduled = []; let count = 0;
  const result = await generatePhoto(body, { env, fetcher: async url => {
    if (url.includes('metrics.example')) { count++; return new Response('{}'); }
    return new Response(JSON.stringify({ data: [{ b64_json: inputBytes.toString('base64') }] }));
  }, schedule: p => scheduled.push(p), upload: async () => { throw new Error('storage offline'); } });
  await Promise.all(scheduled);
  assert.equal(count, 1); assert.equal(result.archiveFailed, true); assert.equal(result.hostedUrl, null);
  assert.match(result.image, /^data:image\/jpeg;base64,/);
});

test('local design preview never calls providers, uploads or metrics', async () => {
  let calls = 0;
  const result = await generatePhoto({ ...body, mode: 'explorer', variation: 2 }, { preview: true, fetcher: async () => { calls++; throw new Error(); }, upload: async () => { calls++; } });
  assert.equal(calls, 0); assert.equal(result.preview, true); assert.equal(result.archiveFailed, false);
});

test('Cloudinary retries use one public ID, sorted server-side signature and the Starville folder', async () => {
  const forms = [], delays = [];
  const url = await uploadPhoto(inputBytes, 'same-photo', { env, delay: async ms => delays.push(ms), fetcher: async (endpoint, options) => {
    forms.push(options.body);
    return forms.length < 3 ? new Response('{}', { status: 503 }) : new Response('{"secure_url":"https://res.cloudinary.com/test/result.jpg"}');
  } });
  assert.match(url, /^https:/); assert.deepEqual(delays, [2000, 4000]); assert.equal(forms.length, 3);
  for (const form of forms) {
    assert.equal(form.get('folder'), 'Starville-Photobooth'); assert.equal(form.get('public_id'), 'same-photo');
    const signed = `folder=Starville-Photobooth&public_id=same-photo&timestamp=${form.get('timestamp')}test-secret`;
    assert.equal(form.get('signature'), createHash('sha1').update(signed).digest('hex'));
  }
});

test('metrics errors are nonfatal and not retried', async () => {
  let calls = 0;
  await incrementMetrics('boss', 0, { env, fetcher: async () => { calls++; throw new Error('offline'); } });
  assert.equal(calls, 1);
});

test('API rejects cross-origin requests, non-POST methods and invalid JSON before generation', async () => {
  for (const [req, expected] of [
    [{ method: 'GET', headers: {} }, 405],
    [{ method: 'POST', headers: { origin: 'https://other.example', host: 'booth.example' } }, 403],
    [{ method: 'POST', headers: { 'content-type': 'text/plain' } }, 415],
    [{ method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }, 400],
  ]) {
    const res = { setHeader: () => {}, end(data) { this.data = JSON.parse(data); } };
    await handler(req, res); assert.equal(res.statusCode, expected); assert.ok(res.data.error);
  }
});
