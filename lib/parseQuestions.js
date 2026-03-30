import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse qustions.md: Qn blocks with quoted prompt and ✅ Rule|Skill|Agent.
 */
export function parseQuestions(md) {
  const questions = [];
  const parts = md
    .split(/(?=^Q\d+\s*$)/m)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    const header = part.match(/^Q(\d+)\s*$/m);
    if (!header) continue;
    const quote = part.match(/"((?:[^"\\]|\\.)*)"/);
    if (!quote) continue;
    const correct = part.match(/✅\s*(Rule|Skill|Agent)/);
    if (!correct) continue;
    questions.push({
      id: Number(header[1]),
      prompt: quote[1].replace(/\\"/g, '"'),
      correctAnswer: correct[1],
    });
  }

  questions.sort((a, b) => a.id - b.id);
  return questions;
}

export function loadQuestionsFromFile(filePath) {
  const md = fs.readFileSync(filePath, "utf8");
  return parseQuestions(md);
}

const defaultPath = path.join(__dirname, "..", "qustions.md");

if (process.argv[1]?.endsWith("parseQuestions.js")) {
  const list = loadQuestionsFromFile(defaultPath);
  console.log(`Parsed ${list.length} questions from qustions.md`);
  list.slice(0, 2).forEach((q) => console.log(q));
}
