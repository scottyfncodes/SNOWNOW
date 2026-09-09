/**
 * Vercel serverless function — production counterpart of `server/index.mjs`'s
 * `/api/health`. Used by `lib/warmup.ts`'s fire-and-forget ping; on Vercel
 * there's no "asleep process" to wake (see README's "Going live"), so this
 * mostly exists for parity and for manually confirming the API key made it
 * into this deployment's environment.
 */
import { API_KEY, CORS_ORIGIN, cacheSize } from '../server/trafficCore.mjs';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.status(200).json({
    ok: true,
    googleRoutesConfigured: API_KEY.length > 0,
    hasApiKey: API_KEY.length > 0,
    cacheSize: cacheSize(),
    time: new Date().toISOString(),
  });
}
