import { dueItems, groq, readSnapshot, telegram } from './lib.mjs';

const snapshot = await readSnapshot();
const due = dueItems(snapshot);
if (!due.tasks.length && !due.events.length) {
  console.log('No due tasks or events in the notification window.');
  process.exit(0);
}

const context = JSON.stringify({ due, recentNotes: (snapshot.stores.notes || []).slice(0, 8), recentSummaries: (snapshot.stores.summaries || []).slice(0, 3) }, null, 2);
const message = await groq([
  { role: 'system', content: 'Ты персональный AI-коуч. Сгенерируй короткое, живое Telegram-напоминание без шаблонности. Учитывай контекст, усталость, нагрузку и предыдущие записи. Не больше 700 символов.' },
  { role: 'user', content: context }
]);
await telegram(message);
console.log(`Sent Telegram reminder for ${due.tasks.length} tasks and ${due.events.length} events.`);
