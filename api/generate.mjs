import { waitUntil } from '@vercel/functions';
import { BoothError, generatePhoto } from '../server/photobooth.mjs';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Method not allowed.' }); }
  // Browser requests must originate from this deployment, not another website.
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin) {
    try { if (new URL(origin).host !== host) return send(403, { error: 'Please open the photobooth directly.' }); }
    catch { return send(403, { error: 'Invalid origin.' }); }
  }
  if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected a photo request.' });
  try {
    let body = req.body;
    if (!body) {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 3_100_000) throw new BoothError('The photo is too large. Please retake it.', 413);
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { throw new BoothError('Invalid photo request.'); }
    }
    const result = await generatePhoto(body, {
      preview: !process.env.VERCEL && process.env.LOCAL_PREVIEW_MODE === 'true',
      schedule: promise => { if (process.env.VERCEL) waitUntil(promise); else void promise; },
    });
    return send(200, result);
  } catch (error) {
    const known = error instanceof BoothError;
    if (!known) console.warn('[Generation] Unexpected processing error.');
    return send(known ? error.status : 500, { error: known ? error.message : 'Something went wrong creating your portrait. Please try again.' });
  }
}
