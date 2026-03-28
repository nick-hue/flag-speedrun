import { createServer } from 'node:http';
import { URL } from 'node:url';
import { createLeaderboardEntry, listLeaderboardEntries } from './db.js';

const port = Number(process.env.PORT) || 3001;
const maxRequestBodySize = 1_000_000;
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`);

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
      const body = await readJsonBody(request);
      const validationError = validateLeaderboardEntry(body);

      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }

      const entry = createLeaderboardEntry({
        username: body.username.trim(),
        rounds: body.rounds,
        timeCentiseconds: body.timeCentiseconds,
        correctAnswers: body.correctAnswers,
      });

      sendJson(response, 201, { entry });
      return;
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

server.listen(port, () => {
  console.log(`Leaderboard API listening on http://localhost:${port}`);
  console.log(`Allowed frontend origin: ${allowedOrigin}`);
  console.log(`Share this URL on your local network: ${allowedOrigin}`);
  console.log(`API health check: ${allowedOrigin}/api/health`);
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

  if (!Number.isInteger(body.rounds) || body.rounds <= 0) {
    return 'rounds must be a positive integer.';
  }

  if (!Number.isInteger(body.timeCentiseconds) || body.timeCentiseconds <= 0) {
    return 'timeCentiseconds must be a positive integer.';
  }

  if (!Number.isInteger(body.correctAnswers) || body.correctAnswers < 0) {
    return 'correctAnswers must be a non-negative integer.';
  }

  if (body.correctAnswers > body.rounds) {
    return 'correctAnswers cannot be greater than rounds.';
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

class RequestTooLargeError extends Error {}

class InvalidJsonError extends Error {}
