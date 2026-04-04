# Presentation Game

Real-time quiz for live presentations: a **host** runs the game from a laptop while **players** join on their phones. Everyone stays in sync over **WebSockets**. Each question asks players to classify a prompt as **Rule**, **Skill**, or **Agent** (aligned with how teams talk about AI coding assistants).

## Requirements

- **Node.js** 18 or newer

## Run locally

```bash
npm install
npm start
```

Then open:

- **Players:** [http://localhost:3000/](http://localhost:3000/) — join with a name, answer when questions go live.
- **Host:** [http://localhost:3000/host.html](http://localhost:3000/host.html) — advance questions, adjust timer, reset.

The server listens on `PORT` (default **3000**) and binds to `0.0.0.0` by default. Health check: `GET /health`.

## Questions

Questions are loaded from `qustions.md` at startup (see `lib/parseQuestions.js` for the format). To use another file, set:

```bash
QUESTIONS_FILE=/path/to/your.md npm start
```

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Run the HTTP + WebSocket server |
| `npm run parse-check` | Validate / parse the questions file |
| `npm run test:winner` | Smoke test for end-of-game winner logic |
| `npm run loadtest` | Load test helper (see `scripts/loadtest.mjs`) |

## Deploy

This app needs a **long-lived** Node process and **WebSockets** on the same host as the site. See [DEPLOY.md](DEPLOY.md) for Render, Railway, Fly.io, Koyeb, Glitch, and notes on free tiers. A Render blueprint is in [render.yaml](render.yaml).
