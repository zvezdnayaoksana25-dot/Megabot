import './styles.css';
import { exportSnapshot, getAll, getSettings, importSnapshot, put, remove, seedIfEmpty, setSetting, uid } from './db.js';
import { askAI, localCoach } from './ai.js';
import { buildDayPlan, deriveAnalytics, scoreLoad, todayKey } from './taskEngine.js';

const state = { section: 'dashboard', tasks: [], notes: [], events: [], memories: [], summaries: [], messages: [], settings: {}, aiBusy: false };
const sections = [
  ['dashboard', 'Command'], ['tasks', 'Задачи'], ['schedule', 'День'], ['memory', 'Память'], ['analytics', 'Аналитика'], ['insights', 'Инсайты'], ['ai', 'AI вход'], ['settings', 'Синхронизация']
];

const app = document.querySelector('#app');

async function refresh() {
  [state.tasks, state.notes, state.events, state.memories, state.summaries, state.messages, state.settings] = await Promise.all([
    getAll('tasks'), getAll('notes'), getAll('events'), getAll('memories'), getAll('summaries'), getAll('messages'), getSettings()
  ]);
  render();
}

function todayTasks() { return state.tasks.filter((task) => task.status !== 'done' && (!task.deadline || task.deadline.startsWith(todayKey()))); }
function load() { return scoreLoad(state.tasks, state.events); }
function analytics() { return deriveAnalytics(state.tasks, state.notes, state.events); }

function render() {
  app.innerHTML = `
    <aside class="rail glass">
      <div class="brand"><span class="orb"></span><div><b>Megabot</b><small>Cognitive OS</small></div></div>
      <nav>${sections.map(([id, label]) => `<button class="nav ${state.section === id ? 'active' : ''}" data-section="${id}">${label}</button>`).join('')}</nav>
      <div class="sync-pill">${state.settings.githubRepo ? 'GitHub sync готов' : 'Локальная память'}</div>
    </aside>
    <main class="shell">
      ${header()}
      <section class="view">${views[state.section]()}</section>
    </main>`;
  bindGlobal();
}

function header() {
  const l = load();
  return `<header class="topbar glass">
    <div><p class="eyebrow">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${titleFor(state.section)}</h1></div>
    <div class="vitals"><span>${l.label}</span><b>${Math.round(l.total)} мин</b></div>
  </header>`;
}

function titleFor(section) {
  return ({ dashboard: 'Центр управления жизнью', tasks: 'Система задач', schedule: 'Планировщик дня', memory: 'Память и журнал', analytics: 'Поведенческая аналитика', insights: 'AI-инсайты и отчёты', ai: 'Универсальный AI-вход', settings: 'Настройки и резервная память' })[section];
}

const views = {
  dashboard: () => {
    const a = analytics(); const l = load(); const plan = buildDayPlan(todayTasks(), state.events).slice(0, 5);
    return `<div class="grid hero-grid">
      <article class="hero glass"><p class="eyebrow">AI слой</p><h2>${l.advice}</h2><p>${a.pattern}</p><div class="hero-actions"><button data-section="ai">Спросить AI</button><button data-action="auto-plan">Собрать день</button></div></article>
      ${metric('Дисциплина', `${Math.round(a.discipline)}%`, 'Поведение и фокус')}${metric('Завершение', `${a.completion}%`, `${a.done} закрыто / ${a.active} активно`)}${metric('Энергия', `${a.avgEnergy}%`, 'по журналу')}
    </div>
    <div class="grid two"><article class="card glass"><h3>Следующие блоки</h3>${timeline(plan)}</article><article class="card glass"><h3>Активные задачи</h3>${taskList(todayTasks().slice(0, 6))}</article></div>`;
  },
  tasks: () => `<div class="grid two"><article class="card glass"><h3>Новая задача</h3>${taskForm()}</article><article class="card glass"><h3>Оценка нагрузки</h3><p class="big">${load().label}</p><p>${load().advice}</p><button data-action="breakdown">AI декомпозиция главной задачи</button></article></div><article class="card glass"><h3>Задачи</h3>${taskList(state.tasks)}</article>`,
  schedule: () => `<div class="grid two"><article class="card glass"><h3>Добавить блок времени</h3>${eventForm()}</article><article class="card glass"><h3>AI-предложение</h3><p>Система автоматически распределяет задачи по окнам фокуса и оставляет буферы.</p><button data-action="auto-plan">Сгенерировать расписание</button></article></div><article class="card glass"><h3>Сегодня</h3>${timeline(buildDayPlan(todayTasks(), state.events))}</article>`,
  memory: () => `<div class="grid two"><article class="card glass"><h3>Запись в память</h3>${noteForm()}</article><article class="card glass"><h3>Слои памяти</h3><ul class="layers"><li>Raw memory: ${state.memories.length} фрагментов</li><li>Structured memory: task / note / reflection / event</li><li>Compressed memory: ${state.summaries.length} сводок</li><li>Retrieval: релевантный контекст для AI</li></ul></article></div><article class="card glass"><h3>Последние мысли</h3>${notesList(state.notes)}</article>`,
  analytics: () => { const a = analytics(); return `<div class="grid metrics">${metric('Выполнение', `${a.completion}%`, 'закрытые задачи')}${metric('Дисциплина', `${Math.round(a.discipline)}%`, 'индекс поведения')}${metric('Энергия', `${a.avgEnergy}%`, 'среднее состояние')}${metric('Сигналы прокрастинации', a.procrastinationSignals, 'из журнала')}</div><article class="card glass"><h3>Продуктивность по времени суток</h3><div class="bars">${a.hourBuckets.map((b) => `<div><span>${String(b.hour).padStart(2, '0')}:00</span><i style="height:${24 + b.count * 28}px"></i><b>${b.count}</b></div>`).join('')}</div></article><article class="card glass"><h3>Паттерн</h3><p>${a.pattern}</p></article>`; },
  insights: () => `<div class="grid two"><article class="card glass"><h3>Compressed memory</h3><p>Ежедневные и недельные отчёты создаются GitHub Actions и сохраняются в <code>data/memory.json</code>.</p><button data-action="daily-local">Создать локальный отчёт</button></article><article class="card glass"><h3>Telegram coaching</h3><p>Автоматизация использует GROQ_API_KEY, TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID из GitHub Secrets.</p></article></div><article class="card glass"><h3>Отчёты</h3>${summaryList(state.summaries)}</article>`,
  ai: () => `<article class="card chat glass"><div class="messages">${state.messages.map((m) => `<div class="msg ${m.role}">${escapeHtml(m.content)}</div>`).join('')}</div><form id="ai-form" class="composer"><input name="prompt" placeholder="Напиши мысль, просьбу, хаос в голове или команду…" autocomplete="off" /><button>${state.aiBusy ? 'Думаю…' : 'Отправить'}</button></form></article>`,
  settings: () => `<div class="grid two"><article class="card glass"><h3>AI ключ для браузера</h3><p>Не хранится в коде: только локально в IndexedDB. Для автономии используйте GitHub Secrets.</p><input id="groq" type="password" placeholder="Groq API key" value="${state.settings.groqApiKey || ''}"/><button data-action="save-key">Сохранить</button></article><article class="card glass"><h3>GitHub backup</h3><input id="repo" placeholder="owner/repo" value="${state.settings.githubRepo || ''}"/><input id="token" type="password" placeholder="Fine-grained token Contents RW" value="${state.settings.githubToken || ''}"/><button data-action="save-github">Сохранить sync</button><button data-action="push-github">Выгрузить snapshot</button></article></div><article class="card glass"><h3>Экспорт / импорт</h3><button data-action="export">Скачать JSON</button><label class="file">Импорт JSON<input type="file" id="import" accept="application/json"/></label></article>`
};

function metric(label, value, caption) { return `<article class="metric glass"><span>${label}</span><b>${value}</b><small>${caption}</small></article>`; }
function taskForm() { return `<form id="task-form" class="stack"><input name="title" placeholder="Что нужно сделать?" required/><div class="row"><select name="priority"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><input name="deadline" type="datetime-local"/><input name="estimate" type="number" min="5" value="30"/></div><button>Добавить</button></form>`; }
function noteForm() { return `<form id="note-form" class="stack"><input name="title" placeholder="Заголовок" required/><textarea name="content" placeholder="Мысль, рефлексия, наблюдение…"></textarea><div class="row"><input name="energy" type="range" min="0" max="100" value="70"/><select name="mood"><option>focused</option><option>tired</option><option>calm</option><option>stressed</option></select></div><button>Сохранить</button></form>`; }
function eventForm() { return `<form id="event-form" class="stack"><input name="title" placeholder="Название блока" required/><div class="row"><input name="start" type="datetime-local" required/><input name="end" type="datetime-local" required/></div><button>Добавить блок</button></form>`; }
function taskList(tasks) { return `<div class="list">${tasks.map((task) => `<div class="item"><button data-done="${task.id}" class="check ${task.status === 'done' ? 'on' : ''}"></button><div><b>${escapeHtml(task.title)}</b><small>${task.priority} · ${task.estimate || 30} мин · ${task.deadline || 'без дедлайна'}</small>${task.subtasks?.length ? `<em>${task.subtasks.join(' → ')}</em>` : ''}</div><button data-delete-task="${task.id}">×</button></div>`).join('') || '<p class="muted">Пока пусто.</p>'}</div>`; }
function notesList(notes) { return `<div class="list">${notes.map((note) => `<div class="item note"><div><b>${escapeHtml(note.title)}</b><p>${escapeHtml(note.content || '')}</p><small>${note.mood || ''} · energy ${note.energy || '—'}</small></div></div>`).join('') || '<p class="muted">Запишите первую мысль.</p>'}</div>`; }
function timeline(events) { return `<div class="timeline">${events.map((event) => `<div class="slot"><time>${(event.start || '').slice(11, 16)}–${(event.end || '').slice(11, 16)}</time><div><b>${escapeHtml(event.title)}</b><small>${event.generated ? 'AI plan' : event.type || 'event'}</small></div></div>`).join('') || '<p class="muted">Нет блоков на сегодня.</p>'}</div>`; }
function summaryList(summaries) { return summaries.map((s) => `<div class="insight"><b>${s.title || 'Отчёт'}</b><p>${escapeHtml(s.summary || s.content || '')}</p><small>${s.createdAt}</small></div>`).join('') || '<p class="muted">Отчёты появятся после daily workflow.</p>'; }
function escapeHtml(value) { return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }

function bindGlobal() {
  document.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', () => { state.section = button.dataset.section; render(); }));
  document.querySelector('#task-form')?.addEventListener('submit', saveTask);
  document.querySelector('#note-form')?.addEventListener('submit', saveNote);
  document.querySelector('#event-form')?.addEventListener('submit', saveEvent);
  document.querySelector('#ai-form')?.addEventListener('submit', sendAI);
  document.querySelectorAll('[data-done]').forEach((button) => button.addEventListener('click', () => toggleTask(button.dataset.done)));
  document.querySelectorAll('[data-delete-task]').forEach((button) => button.addEventListener('click', () => remove('tasks', button.dataset.deleteTask).then(refresh)));
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => actions[button.dataset.action]?.()));
  document.querySelector('#import')?.addEventListener('change', importFile);
}

async function saveTask(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); await put('tasks', { id: uid('task'), ...data, estimate: Number(data.estimate || 30), status: 'active', subtasks: [], createdAt: new Date().toISOString() }); refresh(); }
async function saveNote(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); await put('notes', { id: uid('note'), ...data, createdAt: new Date().toISOString() }); refresh(); }
async function saveEvent(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); await put('events', { id: uid('event'), ...data, type: 'manual', createdAt: new Date().toISOString() }); refresh(); }
async function toggleTask(id) { const task = state.tasks.find((item) => item.id === id); await put('tasks', { ...task, status: task.status === 'done' ? 'active' : 'done', completedAt: task.status === 'done' ? null : new Date().toISOString() }); refresh(); }
async function sendAI(event) { event.preventDefault(); const prompt = new FormData(event.target).get('prompt'); if (!prompt) return; await put('messages', { id: uid('msg'), role: 'user', content: prompt, createdAt: new Date().toISOString() }); state.aiBusy = true; await refresh(); let content; try { content = await askAI({ apiKey: state.settings.groqApiKey, prompt, memories: state.memories, tasks: state.tasks, notes: state.notes, events: state.events }); } catch { content = localCoach(prompt, load(), analytics()); } await put('messages', { id: uid('msg'), role: 'assistant', content, createdAt: new Date().toISOString() }); state.aiBusy = false; refresh(); }

const actions = {
  'save-key': async () => { await setSetting('groqApiKey', document.querySelector('#groq').value.trim()); refresh(); },
  'save-github': async () => { await setSetting('githubRepo', document.querySelector('#repo').value.trim()); await setSetting('githubToken', document.querySelector('#token').value.trim()); refresh(); },
  'export': async () => download('megabot-memory.json', JSON.stringify(await exportSnapshot(), null, 2)),
  'push-github': pushGithub,
  'auto-plan': async () => { for (const event of buildDayPlan(todayTasks(), [])) await put('events', { ...event, id: uid('event'), createdAt: new Date().toISOString() }); refresh(); },
  'breakdown': async () => { const task = todayTasks()[0]; if (!task) return; await put('tasks', { ...task, subtasks: ['Определи критерий готовности', 'Сделай первый 10-минутный шаг', 'Проверь результат и следующий блок'] }); refresh(); },
  'daily-local': async () => { const a = analytics(); await put('summaries', { id: uid('sum'), title: `Отчёт ${todayKey()}`, summary: `${a.pattern} Выполнение ${a.completion}%, энергия ${a.avgEnergy}%. Рекомендация: завтра начни с самой дорогой когнитивной задачи.`, createdAt: new Date().toISOString() }); refresh(); }
};
async function importFile(event) { const file = event.target.files[0]; if (!file) return; await importSnapshot(JSON.parse(await file.text())); refresh(); }
function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); }
async function pushGithub() { const snapshot = await exportSnapshot(); const repo = state.settings.githubRepo; const token = state.settings.githubToken; if (!repo || !token) return alert('Заполните repo и token'); const url = `https://api.github.com/repos/${repo}/contents/data/memory.json`; const current = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null); await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Sync Megabot memory snapshot', content: btoa(unescape(encodeURIComponent(JSON.stringify(snapshot, null, 2)))), sha: current?.sha }) }); alert('Snapshot выгружен в data/memory.json'); }

seedIfEmpty().then(refresh);
