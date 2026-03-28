# Flag Speedrun

Flag Speedrun is a fast flag quiz game with a leaderboard.

Players choose a round category, trying to guess the correct flag as fast as possible, then submit their time with a username. 

## Screenshots

![Leaderboard](./screenshots/main.png)
![Flags](./screenshots/flags.png)

## Usage

Install dependencies:

```bash
npm install
npm --prefix frontend install
```

Build the frontend:

```bash
npm run build
```

Run the app:

```bash
npm run start:backend
```

Open:

```text
http://localhost:3001
```

## Local Network

Example:

```bash
npm run build
HOST=0.0.0.0 PORT=3001 npm run start:backend
```

Then open:

```text
http://192.168.1.11:3001
```

## Service

There is a `systemd` service template in `deploy/flag-speedrun.service`.

Quick install on a Linux server:

```bash
npm install
npm --prefix frontend install
./deploy/install-service.sh /opt/flag_speedrun flag-speedrun
```
