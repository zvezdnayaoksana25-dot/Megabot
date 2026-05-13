import { groq, readSnapshot, telegram, writeSnapshot } from './lib.mjs';

const snapshot = await readSnapshot();
const day = new Date().toISOString().slice(0, 10);
const stores = snapshot.stores || {};
const today = Object.fromEntries(Object.entries(stores).map(([key, records]) => [key, (records || []).filter((record) => JSON.stringify(record).includes(day))]));
const content = await groq([
  { role: 'system', content: 'Ты аналитический слой когнитивной ОС. Верни структурированный ежедневный анализ: итоги, паттерны поведения, ошибки дисциплины, рекомендации, эмоциональная и когнитивная динамика. Пиши по-русски, конкретно.' },
  { role: 'user', content: JSON.stringify({ day, today, recentContext: stores.summaries?.slice(0, 5) || [] }, null, 2) }
], 'daily-review');

const summary = { id: `summary_${day}`, title: `Ежедневный отчёт ${day}`, summary: content, type: 'daily', createdAt: new Date().toISOString() };
snapshot.stores = { ...stores, summaries: [summary, ...(stores.summaries || []).filter((item) => item.id !== summary.id)] };
await writeSnapshot(snapshot);
await telegram(`🧠 <b>Ежедневный отчёт</b>\n\n${content}`);
console.log(`Daily report saved for ${day}.`);
