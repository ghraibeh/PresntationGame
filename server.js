import http from "http";
import path from "path";
import express from "express";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { loadQuestionsFromFile } from "./lib/parseQuestions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_PATH = path.join(__dirname, "qustions.md");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MIN_QUESTION_SEC = 5;
const MAX_QUESTION_SEC = 120;
let questionDurationSec = 10;

const app = express();
app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let questions = [];
try {
  questions = loadQuestionsFromFile(QUESTIONS_PATH);
} catch (e) {
  console.error("Failed to load qustions.md:", e.message);
}

const participants = new Map(); // ws -> { name }
let hostWs = null;
let questionIndex = -1;
let phase = "lobby"; // lobby | question | reveal | ended
let deadline = 0;
/** @type {Map<object, string>} */
let currentAnswers = new Map();
let questionTimer = null;
/** @type {null | { prompt: string, correctAnswer: string, results: Array<{ name: string, choice: string | null, correct: boolean }> }} */
let lastReveal = null;

function clearQuestionTimer() {
  if (questionTimer) {
    clearTimeout(questionTimer);
    questionTimer = null;
  }
}

function safeSend(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

/** Host or player who sent join with a name — gets questions, results, and full state. */
function isGameClient(ws) {
  return ws === hostWs || participants.has(ws);
}

/** Question / reveal / ended — only people in the game (not anonymous browsers on /). */
function broadcastToGameClients(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1 && isGameClient(client)) client.send(msg);
  }
}

function rosterPayload() {
  return [...participants.values()].map((p) => p.name);
}

function clampQuestionSeconds(n) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return questionDurationSec;
  return Math.min(MAX_QUESTION_SEC, Math.max(MIN_QUESTION_SEC, x));
}

function buildStateForClient(ws) {
  if (!isGameClient(ws)) {
    return {
      type: "state",
      phase: "pregame",
      questionIndex: -1,
      totalQuestions: questions.length,
      roster: rosterPayload(),
      isHost: false,
      deadline: 0,
      lastReveal: null,
      questionDurationSec,
      needsName: true,
    };
  }

  const base = {
    type: "state",
    phase,
    questionIndex,
    totalQuestions: questions.length,
    roster: rosterPayload(),
    isHost: ws === hostWs,
    deadline,
    lastReveal,
    questionDurationSec,
  };
  if (phase === "question" && questionIndex >= 0 && questionIndex < questions.length) {
    const q = questions[questionIndex];
    base.question = {
      index: questionIndex,
      prompt: q.prompt,
      choices: ["Rule", "Skill", "Agent"],
    };
  }
  return base;
}

function sendState(ws) {
  safeSend(ws, buildStateForClient(ws));
}

function broadcastState() {
  for (const client of wss.clients) {
    sendState(client);
  }
}

function reveal() {
  clearQuestionTimer();
  if (phase !== "question" || questionIndex < 0 || questionIndex >= questions.length) return;

  const q = questions[questionIndex];
  const results = [];
  for (const [sock, { name }] of participants) {
    const choice = currentAnswers.get(sock) ?? null;
    const correct = choice === q.correctAnswer;
    results.push({ name, choice, correct });
  }

  lastReveal = {
    prompt: q.prompt,
    correctAnswer: q.correctAnswer,
    results,
  };

  phase = "reveal";
  deadline = 0;
  broadcastToGameClients({ type: "reveal", ...lastReveal, questionIndex });
  broadcastState();
}

function startQuestion(idx) {
  clearQuestionTimer();
  if (idx < 0 || idx >= questions.length) return;

  questionIndex = idx;
  phase = "question";
  lastReveal = null;
  currentAnswers = new Map();
  const ms = questionDurationSec * 1000;
  deadline = Date.now() + ms;

  const q = questions[questionIndex];
  broadcastToGameClients({
    type: "question",
    questionIndex,
    prompt: q.prompt,
    choices: ["Rule", "Skill", "Agent"],
    endsAt: deadline,
    durationSec: questionDurationSec,
  });
  broadcastState();

  questionTimer = setTimeout(reveal, ms);
}

function endGame() {
  clearQuestionTimer();
  phase = "ended";
  deadline = 0;
  lastReveal = null;
  broadcastToGameClients({ type: "ended", totalQuestions: questions.length });
  broadcastState();
}

wss.on("connection", (ws) => {
  sendState(ws);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === "joinHost") {
      if (hostWs && hostWs !== ws && hostWs.readyState === 1) {
        safeSend(ws, { type: "error", message: "Host already connected." });
        return;
      }
      hostWs = ws;
      participants.delete(ws);
      broadcastState();
      return;
    }

    if (msg.type === "join" && typeof msg.name === "string") {
      const name = msg.name.trim().slice(0, 64);
      if (!name) {
        safeSend(ws, { type: "error", message: "Enter a name." });
        return;
      }
      if (hostWs === ws) hostWs = null;
      participants.set(ws, { name });
      broadcastState();
      return;
    }

    if (msg.type === "answer" && typeof msg.choice === "string") {
      if (phase !== "question") return;
      if (!participants.has(ws)) return;
      const c = msg.choice;
      if (!["Rule", "Skill", "Agent"].includes(c)) return;
      currentAnswers.set(ws, c);
      safeSend(ws, { type: "answerAck", choice: c });
      return;
    }

    if (msg.type === "setQuestionDuration") {
      if (ws !== hostWs) return;
      questionDurationSec = clampQuestionSeconds(msg.seconds);
      broadcastState();
      return;
    }

    if (msg.type === "nextQuestion") {
      if (ws !== hostWs) return;
      if (questions.length === 0) {
        safeSend(ws, { type: "error", message: "No questions loaded (check qustions.md)." });
        return;
      }
      if (phase === "question") return;

      if (phase === "lobby" || phase === "ended") {
        startQuestion(0);
        return;
      }
      if (phase === "reveal") {
        const next = questionIndex + 1;
        if (next >= questions.length) {
          endGame();
          return;
        }
        startQuestion(next);
      }
      return;
    }

    if (msg.type === "resetGame") {
      if (ws !== hostWs) return;
      clearQuestionTimer();
      phase = "lobby";
      questionIndex = -1;
      deadline = 0;
      lastReveal = null;
      currentAnswers = new Map();
      broadcastState();
    }
  });

  ws.on("close", () => {
    if (ws === hostWs) hostWs = null;
    participants.delete(ws);
    currentAnswers.delete(ws);
    broadcastState();
  });
});

server.listen(PORT, HOST, () => {
  const base = HOST === "0.0.0.0" ? "http://localhost:" + PORT : `http://${HOST}:${PORT}`;
  console.log(`Presentation game: ${base}/`);
  console.log(`Host console:      ${base}/host.html`);
  console.log(`Loaded ${questions.length} questions from qustions.md`);
});
