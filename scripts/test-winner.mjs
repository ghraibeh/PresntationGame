#!/usr/bin/env node
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";
import assert from "assert/strict";
import WebSocket from "ws";

const PORT = 4011;
const HOST = "127.0.0.1";
const BASE = `http://${HOST}:${PORT}`;
const WS_URL = `ws://${HOST}:${PORT}/`;

const fixture = `Q1

"Rule question"

✅ Rule
❌ Skill
❌ Agent

Q2

"Skill question"

❌ Rule
✅ Skill
❌ Agent
`;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function connectClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const t = setTimeout(() => reject(new Error("ws connect timeout")), 8000);
    ws.on("open", () => {
      clearTimeout(t);
      resolve(ws);
    });
    ws.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "presentation-game-test-"));
  const questionsFile = path.join(dir, "questions-test.md");
  writeFileSync(questionsFile, fixture, "utf8");

  const server = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), HOST, QUESTIONS_FILE: questionsFile },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  let logs = "";
  server.stdout.on("data", (d) => {
    const s = String(d);
    logs += s;
    if (s.includes("Loaded 2 questions")) ready = true;
  });
  server.stderr.on("data", (d) => {
    logs += String(d);
  });

  for (let i = 0; i < 50 && !ready; i++) {
    await wait(100);
  }
  if (!ready) {
    server.kill("SIGKILL");
    throw new Error("server not ready\n" + logs);
  }

  const host = await connectClient();
  const p1 = await connectClient();
  const p2 = await connectClient();

  let endedPayload = null;
  let revealCount = 0;

  host.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.type === "question") {
      // p1 answers both correctly, p2 answers both incorrectly
      if (msg.questionIndex === 0) {
        p1.send(JSON.stringify({ type: "answer", choice: "Rule" }));
        p2.send(JSON.stringify({ type: "answer", choice: "Agent" }));
      } else if (msg.questionIndex === 1) {
        p1.send(JSON.stringify({ type: "answer", choice: "Skill" }));
        p2.send(JSON.stringify({ type: "answer", choice: "Rule" }));
      }
    }
    if (msg.type === "reveal") {
      revealCount += 1;
      setTimeout(() => {
        host.send(JSON.stringify({ type: "nextQuestion" }));
      }, 10);
    }
    if (msg.type === "ended") {
      endedPayload = msg;
    }
  });

  host.send(JSON.stringify({ type: "joinHost" }));
  p1.send(JSON.stringify({ type: "join", name: "Alice" }));
  p2.send(JSON.stringify({ type: "join", name: "Bob" }));

  // 5s min duration in server clamp; 2 questions => ~10s
  host.send(JSON.stringify({ type: "setQuestionDuration", seconds: 5 }));
  await wait(50);
  host.send(JSON.stringify({ type: "nextQuestion" }));

  const deadline = Date.now() + 18000;
  while (!endedPayload && Date.now() < deadline) {
    await wait(100);
  }

  assert.ok(endedPayload, "Expected ended payload");
  assert.equal(endedPayload.totalQuestions, 2, "Expected 2 questions in test game");
  assert.equal(revealCount, 2, "Expected two reveal rounds");
  assert.deepEqual(endedPayload.winners, ["Alice"], "Alice should be sole winner");
  assert.equal(endedPayload.topScore, 2, "Winner should have score 2");

  const standings = endedPayload.standings || [];
  assert.equal(standings.length, 2, "Expected standings for two players");
  assert.equal(standings[0].name, "Alice");
  assert.equal(standings[0].score, 2);
  assert.equal(standings[1].name, "Bob");
  assert.equal(standings[1].score, 0);

  console.log("Winner test passed:", endedPayload);

  host.close();
  p1.close();
  p2.close();
  server.kill("SIGTERM");
  rmSync(dir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
