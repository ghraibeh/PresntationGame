# Host the game online (free)

The QR code and player link use **this website’s address** (`https://your-app.onrender.com/`). Run the app on a free host so phones get a real public URL (no LAN or localhost).

## Render (recommended)

1. Push this project to **GitHub**.
2. Sign up at [render.com](https://render.com) and create a **New Web Service**.
3. Connect the repo, pick the branch, and confirm:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Use the **Free** instance type. Render sets `PORT` automatically; the app listens on `0.0.0.0`.
5. After deploy, open `https://<your-service>.onrender.com/host.html` as **host** and share `https://<your-service>.onrender.com/` (or the QR) with players.

Optional: add a `render.yaml` from this repo via **Blueprint** to pre-fill settings.

**Note:** Free services **spin down** after idle. The first visitor after that may wait ~30–60s while it wakes up.

## Railway

1. Push to GitHub, open [railway.app](https://railway.app), **New Project** → **Deploy from GitHub**.
2. Railway detects Node and runs `npm start` (or use the included `Procfile`).
3. Generate a **public domain** in the service settings and use that URL like above.

## Fly.io

1. Install the Fly CLI, run `fly launch` in this folder, and follow prompts.
2. Ensure the process binds to `0.0.0.0` and `PORT` (already the case).

## Custom questions

Commit your `qustions.md` in the repo (or edit on the host and redeploy) so production uses your deck.
