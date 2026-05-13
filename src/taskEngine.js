export const priorityWeight = { high: 3, medium: 2, low: 1 };

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function scoreLoad(tasks, events, date = todayKey()) {
  const active = tasks.filter((task) => task.status !== 'done' && (task.deadline || '').startsWith(date));
  const plannedMinutes = active.reduce((sum, task) => sum + Number(task.estimate || 30), 0);
  const calendarMinutes = events.filter((event) => (event.start || '').startsWith(date)).reduce((sum, event) => {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    return sum + Math.max(0, (end - start) / 60000);
  }, 0);
  const total = plannedMinutes + calendarMinutes;
  const loadRatio = total / 420;
  return {
    plannedMinutes,
    calendarMinutes,
    total,
    loadRatio,
    label: loadRatio > 1.1 ? 'Перегруз' : loadRatio > 0.85 ? 'Плотный день' : 'Реалистичный план',
    advice: loadRatio > 1.1 ? 'Сократи 1–2 задачи или перенеси низкий приоритет.' : 'Нагрузка выглядит управляемой.'
  };
}

export function buildDayPlan(tasks, existingEvents, date = todayKey()) {
  const blocks = [...existingEvents.filter((event) => (event.start || '').startsWith(date))];
  let cursor = new Date(`${date}T09:00:00`);
  const candidates = tasks
    .filter((task) => task.status !== 'done')
    .sort((a, b) => (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1));

  candidates.forEach((task) => {
    const minutes = Number(task.estimate || 30);
    const end = new Date(cursor.getTime() + minutes * 60000);
    blocks.push({
      id: `plan_${task.id}`,
      taskId: task.id,
      title: task.title,
      start: cursor.toISOString().slice(0, 16),
      end: end.toISOString().slice(0, 16),
      type: 'focus',
      generated: true
    });
    cursor = new Date(end.getTime() + 15 * 60000);
    if (cursor.getHours() === 12) cursor = new Date(`${date}T13:00:00`);
  });
  return blocks.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}

export function deriveAnalytics(tasks, notes, events) {
  const done = tasks.filter((task) => task.status === 'done').length;
  const active = tasks.filter((task) => task.status !== 'done').length;
  const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const energy = notes.map((note) => Number(note.energy)).filter(Boolean);
  const avgEnergy = energy.length ? Math.round(energy.reduce((a, b) => a + b, 0) / energy.length) : 66;
  const hours = events.concat(tasks.map((task) => ({ start: task.deadline }))).map((item) => new Date(item.start || item.deadline).getHours()).filter((hour) => !Number.isNaN(hour));
  const hourBuckets = [6, 9, 12, 15, 18, 21].map((hour) => ({ hour, count: hours.filter((h) => h >= hour && h < hour + 3).length }));
  const procrastinationSignals = notes.filter((note) => /отлож|устал|не усп|хаос|прокраст/i.test(`${note.title} ${note.content}`)).length;
  return {
    completion,
    done,
    active,
    avgEnergy,
    hourBuckets,
    procrastinationSignals,
    discipline: Math.max(12, Math.min(96, completion * 0.7 + avgEnergy * 0.3 - procrastinationSignals * 8)),
    pattern: procrastinationSignals ? 'Есть признаки усталости или избегания сложных задач.' : 'Паттерн стабильный: явных сигналов прокрастинации мало.'
  };
}

export function retrieveContext(memories, query, limit = 8) {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  return memories
    .map((memory) => ({
      memory,
      score: terms.reduce((score, term) => score + (`${memory.text} ${memory.type}`.toLowerCase().includes(term) ? 1 : 0), 0)
        + (Date.now() - new Date(memory.createdAt).getTime() < 86400000 ? 0.5 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.memory);
}
