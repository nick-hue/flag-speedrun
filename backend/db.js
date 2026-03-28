import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDirectory = resolve('backend/data');
const databasePath = resolve(dataDirectory, 'leaderboard.db');

mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);

database.exec(`
  CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    rounds INTEGER NOT NULL,
    time_centiseconds INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS leaderboard_rounds_time_idx
    ON leaderboard_entries (rounds, time_centiseconds, created_at);
`);

const insertEntryStatement = database.prepare(`
  INSERT INTO leaderboard_entries (
    username,
    rounds,
    time_centiseconds,
    correct_answers
  ) VALUES (?, ?, ?, ?)
`);

const selectLeaderboardStatement = database.prepare(`
  SELECT
    id,
    username,
    rounds,
    time_centiseconds AS timeCentiseconds,
    correct_answers AS correctAnswers,
    created_at AS createdAt
  FROM leaderboard_entries
  WHERE rounds = COALESCE(?, rounds)
  ORDER BY time_centiseconds ASC, correct_answers DESC, created_at ASC
  LIMIT ?
`);

const selectEntryStatement = database.prepare(`
  SELECT
    id,
    username,
    rounds,
    time_centiseconds AS timeCentiseconds,
    correct_answers AS correctAnswers,
    created_at AS createdAt
  FROM leaderboard_entries
  WHERE id = ?
`);

export function createLeaderboardEntry(entry) {
  const result = insertEntryStatement.run(
    entry.username,
    entry.rounds,
    entry.timeCentiseconds,
    entry.correctAnswers,
  );

  return getLeaderboardEntryById(result.lastInsertRowid);
}

export function listLeaderboardEntries({ rounds, limit }) {
  return selectLeaderboardStatement.all(rounds ?? null, limit);
}

function getLeaderboardEntryById(id) {
  return selectEntryStatement.get(id);
}
