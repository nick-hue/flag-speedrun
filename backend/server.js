import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { URL } from 'node:url';
import { createLeaderboardEntry, listLeaderboardEntries } from './db.js';

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';
const maxRequestBodySize = 1_000_000;
const allowedOrigin = process.env.CORS_ORIGIN || '*';
const sessionTtlMs = 60 * 60 * 1000;
const postRateLimit = {
  maxRequests: 25,
  windowMs: 60 * 1000,
};
const gameSessions = new Map();
const rateLimitByIp = new Map();
const frontendDistDirectory = resolve('frontend/dist');

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`);
    const clientIp = getClientIp(request);

    setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (requestUrl.pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname === '/api/sessions' && request.method === 'POST') {
      if (!checkRateLimit(clientIp)) {
        sendJson(response, 429, { error: 'Too many requests. Please wait a moment and try again.' });
        return;
      }

      const body = await readJsonBody(request);
      const validationError = validateSessionRequest(body);

      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }

      const session = createGameSession(body.rounds);

      sendJson(response, 201, {
        session: {
          id: session.id,
          rounds: session.rounds,
          expiresAt: session.expiresAt,
        },
      });
      return;
    }

    if (requestUrl.pathname === '/api/leaderboard' && request.method === 'GET') {
      const rounds = parseOptionalPositiveInteger(requestUrl.searchParams.get('rounds'));
      const limit = parseOptionalPositiveInteger(requestUrl.searchParams.get('limit')) ?? 10;

      if (rounds === 'invalid' || limit === 'invalid') {
        sendJson(response, 400, { error: 'rounds and limit must be positive integers when provided.' });
        return;
      }

      const entries = listLeaderboardEntries({
        rounds,
        limit: Math.min(limit, 100),
      });

      sendJson(response, 200, { entries });
      return;
    }

    if (requestUrl.pathname === '/api/leaderboard' && request.method === 'POST') {
      if (!checkRateLimit(clientIp)) {
        sendJson(response, 429, { error: 'Too many requests. Please wait a moment and try again.' });
        return;
      }

      const body = await readJsonBody(request);
      const validationError = validateLeaderboardEntry(body);

      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }

      const session = consumeGameSession(body.sessionId);

      if (!session) {
        sendJson(response, 400, { error: 'Session is missing, expired, or already used.' });
        return;
      }

      if (body.correctAnswers > session.rounds) {
        sendJson(response, 400, { error: 'correctAnswers cannot be greater than the session round count.' });
        return;
      }

      const entry = createLeaderboardEntry({
        username: body.username.trim(),
        rounds: session.rounds,
        timeCentiseconds: getElapsedCentiseconds(session.startedAt),
        correctAnswers: body.correctAnswers,
      });

      sendJson(response, 201, { entry });
      return;
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const didServeStaticAsset = await tryServeStaticAsset(requestUrl.pathname, response, request.method);

      if (didServeStaticAsset) {
        return;
      }
    }

    sendJson(response, 404, { error: 'Route not found.' });
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      sendJson(response, 413, { error: 'Request body is too large.' });
      return;
    }

    if (error instanceof InvalidJsonError) {
      sendJson(response, 400, { error: 'Request body must be valid JSON.' });
      return;
    }

    console.error(error);
    sendJson(response, 500, { error: 'Internal server error.' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
    console.error(`Try: PORT=${port + 1} npm run start:backend`);
    process.exit(1);
  }

  throw error;
});

server.listen(port, host, () => {
  console.log(`Flag Speedrun listening on http://localhost:${port}`);
  console.log(`Server bind address: http://${host}:${port}`);
  console.log(`CORS origin: ${allowedOrigin}`);
  console.log(`Open the app at: http://localhost:${port}`);
  console.log(`API health check: http://localhost:${port}/api/health`);
});

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function tryServeStaticAsset(pathname, response, method) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const normalizedPath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const assetPath = join(frontendDistDirectory, normalizedPath);

  try {
    const fileContents = await readFile(assetPath);

    response.writeHead(200, { 'Content-Type': getContentType(assetPath) });

    if (method === 'HEAD') {
      response.end();
      return true;
    }

    response.end(fileContents);
    return true;
  } catch (error) {
    if (pathname.startsWith('/api/')) {
      return false;
    }

    try {
      const indexPath = join(frontendDistDirectory, 'index.html');
      const indexContents = await readFile(indexPath);

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

      if (method === 'HEAD') {
        response.end();
        return true;
      }

      response.end(indexContents);
      return true;
    } catch {
      return false;
    }
  }
}

async function readJsonBody(request) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;

    if (body.length > maxRequestBodySize) {
      throw new RequestTooLargeError();
    }
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new InvalidJsonError();
  }
}

function validateLeaderboardEntry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }

  if (typeof body.sessionId !== 'string' || !body.sessionId.trim()) {
    return 'sessionId is required.';
  }

  if (typeof body.username !== 'string') {
    return 'username is required.';
  }

  const username = body.username.trim();

  if (!username) {
    return 'username cannot be empty.';
  }

  if (username.length > 24) {
    return 'username must be 24 characters or fewer.';
  }

  if (!Number.isInteger(body.correctAnswers) || body.correctAnswers < 0) {
    return 'correctAnswers must be a non-negative integer.';
  }

  return null;
}

function validateSessionRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }

  if (!Number.isInteger(body.rounds) || body.rounds <= 0) {
    return 'rounds must be a positive integer.';
  }

  return null;
}

function parseOptionalPositiveInteger(value) {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return 'invalid';
  }

  return parsedValue;
}

function createGameSession(rounds) {
  cleanupExpiredSessions();

  const session = {
    id: crypto.randomUUID(),
    rounds,
    startedAt: Date.now(),
    expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
  };

  gameSessions.set(session.id, session);

  return session;
}

function consumeGameSession(sessionId) {
  cleanupExpiredSessions();

  const session = gameSessions.get(sessionId);

  if (!session) {
    return null;
  }

  gameSessions.delete(sessionId);
  return session;
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [sessionId, session] of gameSessions.entries()) {
    if (new Date(session.expiresAt).getTime() <= now) {
      gameSessions.delete(sessionId);
    }
  }
}

function getElapsedCentiseconds(startedAt) {
  return Math.max(1, Math.floor((Date.now() - startedAt) / 10));
}

function checkRateLimit(clientIp) {
  const now = Date.now();
  const requestTimestamps = rateLimitByIp.get(clientIp) ?? [];
  const recentRequests = requestTimestamps.filter(
    (timestamp) => now - timestamp < postRateLimit.windowMs,
  );

  if (recentRequests.length >= postRateLimit.maxRequests) {
    rateLimitByIp.set(clientIp, recentRequests);
    return false;
  }

  recentRequests.push(now);
  rateLimitByIp.set(clientIp, recentRequests);
  return true;
}

function getClientIp(request) {
  return request.socket.remoteAddress || 'unknown';
}

function getContentType(filePath) {
  const extension = extname(filePath).toLowerCase();

  switch (extension) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.ico':
      return 'image/x-icon';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

class RequestTooLargeError extends Error {}

class InvalidJsonError extends Error {}
