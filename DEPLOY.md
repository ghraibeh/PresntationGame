# Host the game online (free)

The QR code and player link use **this site’s public URL** (`https://your-app.example/`). Deploy this Node app anywhere below so phones can join.

**This app needs:** Node, `npm start`, `PORT` from the host, and **WebSockets** (same URL for HTTP + WS). Avoid pure serverless hosts that only run short-lived functions.

---

## Alternatives to Render

| Platform | Notes |
|----------|--------|
| **[Railway](https://railway.app)** | GitHub deploy; `npm start`; enable **public domain**. Uses monthly free credits. |
| **[Fly.io](https://fly.io)** | `fly launch` from this folder; good for always-on small apps. Free allowance for low traffic. |
| **[Koyeb](https://www.koyeb.com)** | GitHub → Web Service, **Node**, build `npm install`, run `npm start`. Free tier available. |
| **[Glitch](https://glitch.com)** | Import repo or remix; good for demos; URL looks like `*.glitch.me`. |
| **Render** | See below; free tier sleeps when idle. |

---

## Render

1. Push this project to **GitHub**.
2. [render.com](https://render.com) → **New Web Service** → connect repo.
3. **Build:** `npm install` · **Start:** `npm start` · **Free** instance.
4. Open `https://<service>.onrender.com/host.html` as host; players use the root URL or QR.

Optional: **Blueprint** from `render.yaml` in this repo.

**Note:** Free instances **sleep** after idle (~30–60s cold start on next visit).

---

## Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**.
2. Uses `npm start` (or `Procfile` in this repo).
3. **Settings** → **Networking** → generate **Public Domain**.

---

## Fly.io

1. Install [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/).
2. Run `fly launch` in the project root (creates `fly.toml` if needed).
3. Deploy with `fly deploy`. App must bind `0.0.0.0` and `PORT` (already configured).

---

## Koyeb

1. Sign up at [koyeb.com](https://www.koyeb.com).
2. **Create Web Service** → GitHub → this repo.
3. **Build:** `npm install` · **Run:** `npm start` · **Port:** `8000` or whatever Koyeb sets in `PORT` (they usually inject `PORT`; this app reads `process.env.PORT`).

---

## Glitch

1. Create a project on [glitch.com](https://glitch.com) and import from GitHub, or upload files.
2. Set start script to `npm start` in `package.json` (already set).
3. Share the Glitch **Show** URL; use `/host.html` for the host.

---

## Custom questions

Commit `qustions.md` in the repo (or redeploy after edits) so production uses your deck.
