'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const rootDir = __dirname;

loadEnvFile();

const port = Number(process.env.PORT || 3000);
const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.yml': 'text/yaml; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === '/api/config') {
      return sendJson(res, 200, {
        configured: Boolean(googleApiKey),
        frontendOriginConfigured: allowedOrigins.length > 0,
      });
    }

    if (requestUrl.pathname === '/api/nearby') {
      return handleNearby(requestUrl, res);
    }

    if (requestUrl.pathname.startsWith('/api/place/')) {
      return handlePlaceDetails(requestUrl, res);
    }

    return serveStatic(requestUrl.pathname, res);
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || 'Unexpected server error.',
    });
  }
});

server.listen(port, () => {
  console.log(`Hawker Hunt is running at http://localhost:${port}`);
});

async function handleNearby(requestUrl, res) {
  if (!googleApiKey) {
    return sendJson(res, 400, {
      error: 'GOOGLE_MAPS_API_KEY is missing. Add it to .env and restart the server.',
    });
  }

  const lat = Number(requestUrl.searchParams.get('lat'));
  const lng = Number(requestUrl.searchParams.get('lng'));
  const radius = clampNumber(Number(requestUrl.searchParams.get('radius')), 200, 50000, 1200);
  const rankPreference = requestUrl.searchParams.get('rankPreference') || 'DISTANCE';
  const openNow = requestUrl.searchParams.get('openNow') === 'true';
  const priceLevel = requestUrl.searchParams.get('priceLevel');
  const mode = requestUrl.searchParams.get('mode') || 'nearby';

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return sendJson(res, 400, { error: 'Latitude and longitude are required.' });
  }

  let payload;

  if (mode === 'text') {
    const textQuery = requestUrl.searchParams.get('textQuery');

    if (!textQuery) {
      return sendJson(res, 400, { error: 'A text query is required for text searches.' });
    }

    const body = {
      textQuery: `${textQuery} in Singapore`,
      maxResultCount: 16,
      rankPreference,
      locationBias: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius,
        },
      },
    };

    if (openNow) {
      body.openNow = true;
    }

    if (priceLevel) {
      body.priceLevels = [priceLevel];
    }

    payload = await googleRequest({
      path: '/v1/places:searchText',
      method: 'POST',
      fieldMask: nearbyFieldMask(),
      body,
    });
  } else {
    const includedType = requestUrl.searchParams.get('includedType') || 'restaurant';
    const body = {
      includedTypes: [includedType],
      maxResultCount: 16,
      rankPreference,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius,
        },
      },
    };

    if (openNow) {
      body.openNow = true;
    }

    if (priceLevel) {
      body.priceLevels = [priceLevel];
    }

    payload = await googleRequest({
      path: '/v1/places:searchNearby',
      method: 'POST',
      fieldMask: nearbyFieldMask(),
      body,
    });
  }

  return sendJson(res, 200, payload);
}

async function handlePlaceDetails(requestUrl, res) {
  if (!googleApiKey) {
    return sendJson(res, 400, {
      error: 'GOOGLE_MAPS_API_KEY is missing. Add it to .env and restart the server.',
    });
  }

  const placeId = decodeURIComponent(requestUrl.pathname.replace('/api/place/', ''));

  if (!placeId) {
    return sendJson(res, 400, { error: 'A place id is required.' });
  }

  const payload = await googleRequest({
    path: `/v1/places/${encodeURIComponent(placeId)}`,
    method: 'GET',
    fieldMask: [
      'displayName',
      'formattedAddress',
      'googleMapsUri',
      'location',
      'rating',
      'userRatingCount',
      'priceLevel',
      'websiteUri',
      'currentOpeningHours.openNow',
      'reviews',
      'primaryTypeDisplayName',
    ].join(','),
  });

  return sendJson(res, 200, payload);
}

function serveStatic(requestPath, res) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(rootDir, normalizedPath);

  if (!filePath.startsWith(rootDir)) {
    return sendText(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      if (error.code === 'ENOENT') {
        return sendText(res, 404, 'Not found');
      }

      return sendText(res, 500, 'Could not read file');
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    });
    res.end(file);
  });
}

function googleRequest({ path: requestPath, method, fieldMask, body }) {
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    'X-Goog-Api-Key': googleApiKey,
    'X-Goog-FieldMask': fieldMask,
  };

  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'places.googleapis.com',
        path: requestPath,
        method,
        headers,
      },
      response => {
        let raw = '';

        response.on('data', chunk => {
          raw += chunk;
        });

        response.on('end', () => {
          const parsed = raw ? JSON.parse(raw) : {};

          if (response.statusCode >= 400) {
            const message =
              parsed.error?.message || 'Google Places request failed unexpectedly.';
            reject(new Error(message));
            return;
          }

          resolve(parsed);
        });
      }
    );

    request.on('error', reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowOrigin =
    !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) ? origin || '*' : '';

  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function nearbyFieldMask() {
  return [
    'places.id',
    'places.displayName',
    'places.location',
    'places.formattedAddress',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    'places.googleMapsUri',
    'places.primaryTypeDisplayName',
    'places.currentOpeningHours.openNow',
  ].join(',');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end(text);
}

function loadEnvFile() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  lines.forEach(line => {
    if (!line || line.trim().startsWith('#')) return;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}
