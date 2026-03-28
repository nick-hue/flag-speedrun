# Backend

Small Node-based leaderboard API backed by SQLite.

## Endpoints

- `GET /api/health`
- `GET /api/leaderboard?rounds=20&limit=10`
- `POST /api/leaderboard`

## Example payload

```json
{
  "username": "beast",
  "rounds": 20,
  "timeCentiseconds": 5234,
  "correctAnswers": 18
}
```
