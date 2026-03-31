#!/usr/bin/env node
/**
 * Load test: N concurrent WebSocket clients (player join), held for HOLD_SEC each.
 *
 * Usage:
 *   node scripts/loadtest.mjs [BASE_URL] [CONCURRENCY] [HOLD_SEC]
 *
 * Example:
 *   node scripts/loadtest.mjs https://web-production-57716.up.railway.app 50 30
 */

import WebSocket from "ws";

const baseRaw = process.argv[2] || "http://localhost:3000";
const concurrency = Math.min(500, Math.max(1, Number(process.argv[3]) || 50));
const holdSec = Math.min(600, Math.max(5, Number(process.argv[4]) || 30));
const connectTimeoutMs = 45_000;

const httpUrl = new URL(baseRaw.includes("://") ? baseRaw : `https://${baseRaw}`);
const origin = httpUrl.origin;
const wsUrl = `${httpUrl.protocol === "https:" ? "wss:" : "ws:"}//${httpUrl.host}/`;

function onePlayer(id) {
  return new Promise((resolve) => {
    const started = performance.now();
    let msgCount = 0;
    let settled = false;

    const done = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };

    const ws = new WebSocket(wsUrl);

    const connTimer = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.terminate();
        } catch (_) {}
        done({
          id,
          ok: false,
          error: "connect_timeout",
          msOpen: null,
          msgCount,
        });
      }
    }, connectTimeoutMs);

    ws.on("message", () => {
      msgCount++;
    });

    ws.on("open", () => {
      clearTimeout(connTimer);
      const msOpen = Math.round(performance.now() - started);
      try {
        ws.send(JSON.stringify({ type: "join", name: `loadtest-${id}` }));
      } catch (e) {
        try {
          ws.close();
        } catch (_) {}
        done({ id, ok: false, error: "send_failed:" + e.message, msOpen, msgCount });
        return;
      }

      setTimeout(() => {
        const stillUp = ws.readyState === WebSocket.OPEN;
        try {
          ws.close();
        } catch (_) {}
        done({
          id,
          ok: stillUp,
          error: stillUp ? null : "closed_during_hold",
          msOpen,
          msgCount,
        });
      }, holdSec * 1000);
    });

    ws.on("error", (e) => {
      clearTimeout(connTimer);
      done({
        id,
        ok: false,
        error: e.message || "ws_error",
        msOpen: null,
        msgCount,
      });
    });
  });
}

async function main() {
  console.log("Presentation game load test");
  console.log("  HTTP:", origin + "/");
  console.log("  WS:  ", wsUrl);
  console.log("  Concurrent players:", concurrency);
  console.log("  Hold per connection:", holdSec + "s");
  console.log("");

  const tHttp = performance.now();
  let warm = { ok: false, status: 0, ms: 0 };
  try {
    const r = await fetch(origin + "/");
    warm = { ok: r.ok, status: r.status, ms: Math.round(performance.now() - tHttp) };
  } catch (e) {
    warm = { ok: false, status: 0, ms: 0, err: e.message };
  }
  console.log(
    "HTTP GET / →",
    warm.ok ? `${warm.status} in ${warm.ms}ms` : `failed ${warm.err || warm.status}`
  );

  const t0 = performance.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) => onePlayer(i + 1))
  );
  const wallMs = Math.round(performance.now() - t0);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const openTimes = results.filter((r) => r.ok && r.msOpen != null).map((r) => r.msOpen);
  openTimes.sort((a, b) => a - b);
  const p50 = openTimes.length ? openTimes[Math.floor(openTimes.length * 0.5)] : null;
  const p95 = openTimes.length ? openTimes[Math.floor(openTimes.length * 0.95)] : null;

  console.log("");
  console.log("WebSocket (join as player, hold " + holdSec + "s):");
  console.log("  Success:", ok + "/" + concurrency);
  console.log("  Failed:", fail);
  console.log("  Wall clock (longest client):", wallMs + "ms");
  if (p50 != null) {
    console.log("  Open+join latency p50 / p95:", p50 + "ms / " + p95 + "ms");
  }

  const errors = {};
  for (const r of results) {
    if (!r.ok && r.error) {
      errors[r.error] = (errors[r.error] || 0) + 1;
    }
  }
  if (Object.keys(errors).length) {
    console.log("  Error breakdown:", errors);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main();
