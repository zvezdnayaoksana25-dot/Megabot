import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SNAPSHOT = {
  version: 1,
  exportedAt: new Date().toISOString(),
  stores: { tasks: [], notes: [], events: [], memories: [], summaries: [], messages: [] }
};
const TELEGRAM_LIMIT = 3900;

export async function readSnapshot(filePath = 'data/memory.json') {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code && error.code !== 'ENOENT') {
      console.warn(`Cannot read ${filePath}; using an empty snapshot: ${error.message}`);
    }
    return structuredClone(DEFAULT_SNAPSHOT);
  }
}

export async function writeSnapshot(snapshot, filePath = 'data/memory.json') {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ ...snapshot, exportedAt: new Date().toISOString() }, null, 2));
}

export function missingEnv(names) {
  return names.filter((name) => !process.env[name]);
}

export async function groq(messages, taskType = 'automation') {
  const missing = missingEnv(['GROQ_API_KEY']);
  if (missing.length) throw new Error(`${missing.join(', ')} is required`);
  const model = ['daily-review', 'weekly-review'].includes(taskType) ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.45 })
  });
  if (!res.ok) throw new Error(`Groq API failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function telegram(text) {
  const missing = missingEnv(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);
  if (missing.length) {
    console.warn(`Skipping Telegram delivery: missing ${missing.join(', ')}.`);
    return false;
  }

  for (const chunk of splitTelegramMessage(text)) {
    const res = await fetchWithRetry(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: chunk, disable_web_page_preview: true })
    });
    if (!res.ok) {
      console.warn(`Skipping failed Telegram delivery: ${res.status} ${await res.text()}`);
      return false;
    }
  }
  return true;
}

export function dueItems(snapshot, now = new Date()) {
  const stores = snapshot.stores || {};
  const windowStart = now.getTime() - 5 * 60000;
  const windowEnd = now.getTime() + 10 * 60000;
  const tasks = (stores.tasks || []).filter((task) => task.status !== 'done' && task.deadline && inWindow(task.deadline, windowStart, windowEnd));
  const events = (stores.events || []).filter((event) => event.start && inWindow(event.start, windowStart, windowEnd));
  return { tasks, events };
}

function splitTelegramMessage(text) {
  const input = String(text || '');
  if (!input) return [''];
  const chunks = [];
  for (let cursor = 0; cursor < input.length; cursor += TELEGRAM_LIMIT) {
    chunks.push(input.slice(cursor, cursor + TELEGRAM_LIMIT));
  }
  return chunks;
}

async function fetchWithRetry(url, options, retries = 2) {
  let lastResponse;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!shouldRetry(response.status) || attempt === retries) return response;
      lastResponse = response;
    } catch (error) {
      if (attempt === retries) throw error;
    }
    await delay(500 * 2 ** attempt);
  }
  return lastResponse;
}

function shouldRetry(status) {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inWindow(value, start, end) {
  const t = new Date(value).getTime();
  return t >= start && t <= end;
}
