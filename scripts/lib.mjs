import fs from 'node:fs/promises';

export async function readSnapshot(path = 'data/memory.json') {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); }
  catch { return { version: 1, exportedAt: new Date().toISOString(), stores: { tasks: [], notes: [], events: [], memories: [], summaries: [], messages: [] } }; }
}

export async function writeSnapshot(snapshot, path = 'data/memory.json') {
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(path, JSON.stringify({ ...snapshot, exportedAt: new Date().toISOString() }, null, 2));
}

export async function groq(messages, taskType = 'automation') {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is required');
  const model = ['daily-review', 'weekly-review'].includes(taskType) ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, temperature: 0.45 }) });
  if (!res.ok) throw new Error(`Groq API failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function telegram(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) throw new Error('Telegram secrets are required');
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!res.ok) throw new Error(`Telegram failed: ${res.status} ${await res.text()}`);
}

export function dueItems(snapshot, now = new Date()) {
  const stores = snapshot.stores || {};
  const windowStart = now.getTime() - 5 * 60000;
  const windowEnd = now.getTime() + 10 * 60000;
  const tasks = (stores.tasks || []).filter((task) => task.status !== 'done' && task.deadline && inWindow(task.deadline, windowStart, windowEnd));
  const events = (stores.events || []).filter((event) => event.start && inWindow(event.start, windowStart, windowEnd));
  return { tasks, events };
}

function inWindow(value, start, end) { const t = new Date(value).getTime(); return t >= start && t <= end; }
