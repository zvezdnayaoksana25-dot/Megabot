import { retrieveContext } from './taskEngine.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const STRONG_MODEL = 'llama-3.3-70b-versatile';

export function selectModel(taskType = 'chat') {
  return ['daily-review', 'weekly-review', 'complex-planning'].includes(taskType) ? STRONG_MODEL : DEFAULT_MODEL;
}

export async function callGroq({ apiKey, messages, taskType = 'chat', temperature = 0.45 }) {
  if (!apiKey) throw new Error('Добавьте Groq API key в настройках или используйте GitHub Actions secrets для автономных процессов.');
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: selectModel(taskType), messages, temperature })
  });
  if (!response.ok) throw new Error(`Groq API error: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export function systemPrompt() {
  return `Ты верхний AI-слой персональной когнитивной ОС. Не веди себя как чат-бот: превращай ввод в ясные решения, задачи, расписание, инсайты и дисциплину. Отвечай кратко, структурно, с конкретным следующим действием. Если видишь перегруз — предложи реалистичную перестройку.`;
}

export async function askAI({ apiKey, prompt, memories = [], tasks = [], notes = [], events = [] }) {
  const context = retrieveContext(memories, prompt).map((memory) => `- [${memory.type}] ${memory.text}`).join('\n');
  const state = JSON.stringify({ tasks: tasks.slice(0, 12), recentNotes: notes.slice(0, 8), todayEvents: events.slice(0, 12) }, null, 2);
  return callGroq({
    apiKey,
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: `Контекст памяти:\n${context || 'пока пусто'}\n\nСостояние системы:\n${state}\n\nЗапрос пользователя: ${prompt}` }
    ]
  });
}

export function localCoach(prompt, load, analytics) {
  const overloaded = load.loadRatio > 1;
  return [
    overloaded ? 'Я вижу риск перегруза. Не добавляй новые обязательства, пока не освободишь 45–60 минут.' : 'План выглядит достаточно реалистично. Главное — начать с одного измеримого шага.',
    `Дисциплина сейчас: ${Math.round(analytics.discipline)}%. ${analytics.pattern}`,
    `Следующее действие: ${prompt.length > 20 ? 'преврати мысль в одну задачу или блок времени.' : 'выбери главный фокус на ближайшие 25 минут.'}`
  ].join('\n');
}
