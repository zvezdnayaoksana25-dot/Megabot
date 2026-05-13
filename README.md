# Megabot Cognitive OS

**Megabot Cognitive OS** — это полностью serverless веб-приложение для GitHub Pages: персональный AI-центр управления задачами, расписанием, памятью, дневником, аналитикой поведения, инсайтами и Telegram-коучингом.

Приложение работает без отдельного backend-сервера:

- фронтенд разворачивается как статический сайт на **GitHub Pages**;
- локальная рабочая память хранится в браузере через **IndexedDB**;
- резервная память может синхронизироваться в `data/memory.json` внутри GitHub-репозитория;
- автономные напоминания и ежедневные отчёты выполняются через **GitHub Actions**;
- AI-запросы выполняются через **Groq API**;
- уведомления доставляются через **Telegram Bot API**.

---

## Что входит в приложение

- **Dashboard** — главный центр управления днём, нагрузкой, фокусом и следующими действиями.
- **Задачи** — создание задач, статусы, приоритеты, дедлайны, оценка времени, декомпозиция.
- **Расписание** — дневные блоки времени, генерация плана дня, интеграция задач в календарную сетку.
- **Память / журнал** — заметки, мысли, рефлексии, mood/energy, структурирование памяти.
- **Аналитика** — выполнение задач, дисциплина, энергия, сигналы прокрастинации, активность по времени суток.
- **AI-вход** — универсальный интерфейс для вопросов, команд, планирования и обработки мыслей.
- **Инсайты** — ежедневные compressed-memory отчёты и Telegram coaching.
- **Синхронизация** — экспорт/импорт JSON и выгрузка snapshot в GitHub.

---

## Архитектура

| Слой | Файлы | Назначение |
| --- | --- | --- |
| UI layer | `index.html`, `src/app.js`, `src/styles.css` | Все экраны приложения, premium mobile-first интерфейс, навигация, формы и визуальная аналитика. |
| Memory layer | `src/db.js` | IndexedDB-хранилище для задач, заметок, событий, сообщений, summaries и settings. |
| AI layer | `src/ai.js` | Groq API, выбор модели по типу задачи, retrieval-aware контекст, fallback coach. |
| Task engine | `src/taskEngine.js` | Оценка нагрузки, генерация расписания, аналитика поведения, retrieval layer. |
| Automation layer | `.github/workflows/*.yml` | GitHub Pages deploy, регулярные напоминания, ежедневные отчёты. |
| Notification layer | `scripts/*.mjs` | Groq-вызовы из Actions и отправка сообщений в Telegram. |

---

## Быстрый локальный запуск

> Проект не требует установки npm-зависимостей. В `package.json` используются только Node.js и Python HTTP server.

### 1. Требования

Установите:

- **Node.js 22+** — нужен для проверки JS-файлов и GitHub Actions parity;
- **Python 3** — используется для локального статического сервера;
- **Git** — для работы с репозиторием.

Проверить версии:

```bash
node --version
python3 --version
git --version
```

### 2. Запуск dev-сервера

```bash
npm run dev
```

После запуска откройте:

```text
http://localhost:5173
```

### 3. Проверка проекта

```bash
npm run check
```

Команда выполняет syntax-check для основных файлов:

- `src/app.js`
- `src/db.js`
- `src/ai.js`
- `src/taskEngine.js`
- `scripts/lib.mjs`
- `scripts/notify.mjs`
- `scripts/daily-report.mjs`

### 4. Production build

```bash
npm run build
```

Результат появится в папке:

```text
dist/
```

### 5. Локальный preview production build

```bash
npm run preview
```

После запуска откройте:

```text
http://localhost:4173
```

---

## Настройка Groq API ключа

Groq используется как LLM-провайдер для AI-слоя приложения и GitHub Actions automation.

### Где получить ключ

1. Перейдите в Groq Console: `https://console.groq.com/`.
2. Создайте аккаунт или войдите.
3. Откройте раздел **API Keys**.
4. Создайте новый ключ.
5. Скопируйте значение ключа.

### Как используется ключ

Есть два режима использования Groq API:

#### 1. В браузере

Для ручного AI-чата внутри приложения:

1. Откройте приложение.
2. Перейдите в раздел **Синхронизация**.
3. Вставьте ключ в поле **Groq API key**.
4. Нажмите **Сохранить**.

Ключ сохраняется только локально в браузере в IndexedDB/settings. Он не зашит в код и не попадает в репозиторий.

#### 2. В GitHub Actions

Для автономных Telegram-напоминаний и ежедневных отчётов ключ нужно добавить в GitHub Secrets под именем:

```text
GROQ_API_KEY
```

Подробная инструкция по GitHub Secrets находится ниже.

---

## Настройка Telegram Bot API

Telegram используется только как канал доставки уведомлений и отчётов.

### 1. Создайте Telegram-бота

1. Откройте Telegram.
2. Найдите бота `@BotFather`.
3. Отправьте команду:

```text
/newbot
```

4. Задайте имя и username бота.
5. BotFather выдаст токен вида:

```text
1234567890:AAExampleTelegramBotToken
```

Этот токен понадобится как GitHub Secret:

```text
TELEGRAM_BOT_TOKEN
```

### 2. Получите Telegram Chat ID

Вариант для личного чата:

1. Напишите любое сообщение своему новому боту.
2. Откройте в браузере URL, подставив токен:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

3. Найдите в JSON поле:

```json
"chat": { "id": 123456789 }
```

4. Это значение добавьте как GitHub Secret:

```text
TELEGRAM_CHAT_ID
```

Для группового чата добавьте бота в группу, отправьте сообщение в группу и также проверьте `getUpdates`. У групповых chat id часто отрицательное значение.

---

## Настройка GitHub репозитория

### 1. Создайте репозиторий

1. Создайте новый GitHub repository.
2. Загрузите туда код приложения.
3. Убедитесь, что workflows находятся в папке:

```text
.github/workflows/
```

### 2. Включите GitHub Pages через Actions

1. Откройте repository **Settings**.
2. Перейдите в **Pages**.
3. В блоке **Build and deployment** выберите:

```text
Source: GitHub Actions
```

4. Если GitHub показывает экран с предложенными workflow, выберите:

```text
Static HTML
```

Не выбирайте `GitHub Pages Jekyll`: проект не использует Jekyll, а собирает обычный static build в папку `dist`. Если в репозитории уже есть `.github/workflows/pages.yml`, не создавайте второй Pages workflow из шаблона — просто сохраните `Source: GitHub Actions` и запускайте существующий workflow **Deploy GitHub Pages**.

5. Сохраните настройки.

### 3. Добавьте GitHub Secrets

Откройте:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Добавьте обязательные секреты для AI-автоматизаций:

| Secret | Для чего нужен |
| --- | --- |
| `GROQ_API_KEY` | Вызовы LLM из GitHub Actions для напоминаний и daily reports. |
| `TELEGRAM_BOT_TOKEN` | Отправка сообщений через Telegram Bot API. |
| `TELEGRAM_CHAT_ID` | ID пользователя или чата, куда отправлять уведомления. |

Опционально для первого автоматического включения GitHub Pages можно добавить:

| Secret | Для чего нужен |
| --- | --- |
| `PAGES_TOKEN` | Fine-grained token с правами администрирования Pages. Нужен только если Pages ещё не включён вручную в Settings → Pages. |

Важно: не добавляйте эти значения в код, README, issues или commits.

---

## Деплой на GitHub Pages

Workflow деплоя не вызывает `actions/configure-pages` без `PAGES_TOKEN`, потому что GitHub API возвращает `Get Pages site failed: Not Found`, если Pages ещё не включён. Поэтому перед первым деплоем выберите один из вариантов:

1. **Рекомендуется:** вручную включите `Source: GitHub Actions` в `Settings → Pages`. Если GitHub предлагает шаблоны workflow, выбирайте `Static HTML`, а не `GitHub Pages Jekyll`.
2. **Автоматически:** добавьте secret `PAGES_TOKEN` с правами на администрирование Pages; тогда workflow выполнит `configure-pages` с `enablement: true`.

После настройки Pages есть два способа деплоя.

### Автоматически

Сделайте push в ветку `main`:

```bash
git push origin main
```

Workflow `.github/workflows/pages.yml` соберёт static build и опубликует сайт.

### Вручную

1. Откройте вкладку **Actions**.
2. Выберите workflow **Deploy GitHub Pages**.
3. Нажмите **Run workflow**.
4. В выпадающем списке **Branch** выберите `main`.

Деплой в environment `github-pages` выполняется только из ветки `main`. Если запустить workflow из feature-ветки, например `codex/fix-github-actions-errors`, workflow выполнит build, но пропустит deploy, чтобы GitHub не отклонил публикацию из-за environment protection rules.

После успешного деплоя URL будет доступен в GitHub Pages settings или в summary workflow run.

---

## Настройка автоматических напоминаний

Workflow:

```text
.github/workflows/notify.yml
```

Он запускается по cron каждые 5 минут:

```yaml
- cron: '*/5 * * * *'
```

Что делает workflow:

1. Читает `data/memory.json`.
2. Ищет задачи и события, которые наступают в окне времени.
3. Отправляет контекст в Groq.
4. Получает персонализированное напоминание.
5. Отправляет сообщение в Telegram.

Запустить вручную можно через:

```text
Actions → AI Telegram reminders → Run workflow
```

---

## Настройка ежедневного AI-отчёта

Workflow:

```text
.github/workflows/daily-report.yml
```

Он запускается каждый день по cron:

```yaml
- cron: '55 20 * * *'
```

Время указано в UTC.

Что делает workflow:

1. Читает `data/memory.json`.
2. Собирает данные за текущий день.
3. Отправляет их в Groq.
4. Получает структурированный анализ дня:
   - итоги дня;
   - поведенческие паттерны;
   - ошибки дисциплины;
   - рекомендации;
   - эмоциональная и когнитивная динамика.
5. Сохраняет результат в `stores.summaries` как compressed memory.
6. Коммитит обновлённый `data/memory.json` обратно в репозиторий.
7. Отправляет отчёт в Telegram.

Запустить вручную можно через:

```text
Actions → Daily cognitive report → Run workflow
```

---

## Как работает память

В браузере данные хранятся в IndexedDB:

- `tasks` — задачи;
- `notes` — заметки и дневниковые записи;
- `events` — блоки расписания;
- `memories` — structured memory, автоматически созданная из задач, заметок и событий;
- `summaries` — compressed memory, ежедневные/локальные отчёты;
- `messages` — история AI-входа;
- `settings` — локальные настройки пользователя.

### Экспорт памяти

В приложении:

1. Откройте **Синхронизация**.
2. Нажмите **Скачать JSON**.
3. Сохраните файл как backup.

### Импорт памяти

1. Откройте **Синхронизация**.
2. Нажмите **Импорт JSON**.
3. Выберите ранее сохранённый snapshot.

### GitHub backup из браузера

В разделе **Синхронизация** можно указать:

- `owner/repo` — репозиторий для хранения `data/memory.json`;
- fine-grained GitHub token с доступом **Contents: Read and write**.

После этого кнопка **Выгрузить snapshot** обновит файл:

```text
data/memory.json
```

Этот токен хранится только локально в браузере. Не используйте personal access token с лишними правами.

---

## API ключи и безопасность

В коде нет hardcoded production secrets.

Используются следующие значения:

| Переменная | Где задаётся | Обязательна | Назначение |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | GitHub Secrets / локально в UI | Да для AI automation | Groq LLM-запросы. |
| `TELEGRAM_BOT_TOKEN` | GitHub Secrets | Да для Telegram | Доступ к Telegram Bot API. |
| `TELEGRAM_CHAT_ID` | GitHub Secrets | Да для Telegram | Куда отправлять уведомления. |
| GitHub fine-grained token | Только в UI, локально | Нет | Ручная выгрузка browser snapshot в GitHub. |

Рекомендации:

- никогда не коммитьте `.env` или реальные ключи;
- не вставляйте ключи в `README.md` или публичные issues;
- используйте отдельный Telegram bot только для этого проекта;
- используйте fine-grained GitHub token с минимальными правами;
- при утечке любого ключа сразу удалите его и создайте новый.

---

## Полезные команды

```bash
# Локальный запуск
npm run dev

# Проверка JS-синтаксиса
npm run check

# Static production build
npm run build

# Preview production build
npm run preview
```

---

## Troubleshooting

### GitHub Pages не обновился

Проверьте:

1. Включён ли Source: **GitHub Actions** в Settings → Pages.
2. Если Pages ещё не включён вручную, добавлен ли secret `PAGES_TOKEN` с правами на администрирование Pages. Без него `actions/configure-pages` не может создать Pages site.
3. Запущен ли workflow из ветки `main`. Ветки вроде `codex/fix-github-actions-errors` обычно не имеют права деплоить в environment `github-pages`, поэтому deploy будет пропущен или отклонён правилами защиты.
4. Успешно ли прошёл workflow **Deploy GitHub Pages**.
5. Есть ли артефакт `dist` в workflow run.

### Telegram не получает сообщения

Проверьте:

1. Бот создан через `@BotFather`.
2. Вы написали боту хотя бы одно сообщение.
3. `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` добавлены именно в repository secrets.
4. Workflow `AI Telegram reminders` или `Daily cognitive report` завершился без ошибок.

### Groq API не отвечает

Проверьте:

1. Корректность `GROQ_API_KEY`.
2. Наличие доступных лимитов Groq.
3. Логи GitHub Actions.
4. Для браузерного AI — сохранён ли ключ в разделе **Синхронизация**.

### В браузере пропали данные

Данные хранятся локально в IndexedDB конкретного браузера и профиля. Если очистить site data, локальная память удалится. Используйте экспорт JSON или GitHub backup, чтобы иметь резервную копию.

---

## Структура проекта

```text
.
├── .github/workflows/
│   ├── daily-report.yml
│   ├── notify.yml
│   └── pages.yml
├── data/
│   └── memory.json
├── scripts/
│   ├── daily-report.mjs
│   ├── lib.mjs
│   └── notify.mjs
├── src/
│   ├── ai.js
│   ├── app.js
│   ├── db.js
│   ├── styles.css
│   └── taskEngine.js
├── index.html
├── package.json
└── README.md
```
