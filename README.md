# Megabot Cognitive OS

**Megabot Cognitive OS** — статическое serverless-приложение для GitHub Pages: личная когнитивная ОС для задач, расписания, памяти, дневника, аналитики, AI-входа и Telegram-коучинга.

Приложение не требует отдельного backend-сервера:

- UI публикуется как обычный статический сайт на **GitHub Pages**;
- рабочая память хранится в браузере через **IndexedDB**;
- при недоступном IndexedDB приложение переключается на локальный fallback;
- резервная память экспортируется в JSON или выгружается в `data/memory.json`;
- AI-ответы выполняются через **Groq API**;
- напоминания и ежедневные отчёты запускаются через **GitHub Actions**;
- уведомления отправляются через **Telegram Bot API**.

---

## Возможности

- **Command / Dashboard** — обзор дня, нагрузки, фокуса и следующих блоков.
- **Задачи** — задачи с приоритетом, дедлайном, оценкой времени, статусом и декомпозицией.
- **День** — ручные time-blocks и автоматическая сборка расписания.
- **Память** — заметки, дневник, настроение, энергия и structured memory.
- **Аналитика** — выполнение задач, дисциплина, энергия, сигналы прокрастинации.
- **Инсайты** — compressed memory, локальные и GitHub Actions отчёты.
- **AI вход** — Groq-powered помощник с локальным fallback-коучем.
- **Синхронизация** — экспорт/импорт JSON и ручная выгрузка snapshot в GitHub.

---

## Структура проекта

```text
.
├── .github/workflows/
│   ├── ci.yml              # проверка JS и production build
│   ├── daily-report.yml    # ежедневный AI-отчёт и commit data/memory.json
│   ├── notify.yml          # Telegram-напоминания каждые 5 минут
│   └── pages.yml           # публикация GitHub Pages
├── data/
│   └── memory.json         # резервная compressed/browser memory
├── scripts/
│   ├── daily-report.mjs
│   ├── lib.mjs
│   ├── notify.mjs
│   └── smoke-render.mjs    # smoke-проверка, что UI не пустой
├── src/
│   ├── ai.js
│   ├── app.js
│   ├── db.js
│   ├── styles.css
│   └── taskEngine.js
├── .nojekyll               # GitHub Pages публикует файлы без Jekyll-обработки
├── index.html
├── package.json
└── README.md
```

---

## Локальный запуск

### 1. Установите инструменты

Нужны:

- **Node.js 22+** — для проверок и совпадения с GitHub Actions;
- **Python 3** — для локального статического сервера;
- **Git** — для clone/commit/push.

Проверьте версии:

```bash
node --version
python3 --version
git --version
```

### 2. Склонируйте репозиторий

```bash
git clone https://github.com/<OWNER>/<REPO>.git
cd <REPO>
```

### 3. Запустите dev-сервер

```bash
npm run dev
```

Откройте в браузере:

```text
http://localhost:5173
```

> Не открывайте `index.html` двойным кликом как `file://...`: ES modules и браузерное хранилище корректно работают через HTTP-сервер.

### 4. Проверьте код

```bash
npm run check
```

Команда делает:

1. `node --check` для всех JS/MJS-файлов;
2. smoke-render test `scripts/smoke-render.mjs`, который импортирует приложение, включает fallback-хранилище и проверяет, что dashboard реально отрисовался, а страница не пустая.

### 5. Соберите production-версию

```bash
npm run build
```

После сборки появится папка:

```text
dist/
```

### 6. Проверьте production build локально

```bash
npm run preview
```

Откройте:

```text
http://localhost:4173
```

---

## Запуск и публикация в GitHub Pages

### Шаг 1. Создайте GitHub repository

1. Откройте GitHub.
2. Создайте новый репозиторий.
3. Загрузите туда все файлы проекта, включая:
   - `.github/workflows/pages.yml`;
   - `.github/workflows/ci.yml`;
   - `.nojekyll`;
   - `index.html`;
   - `src/`;
   - `data/`;
   - `scripts/`;
   - `package.json`.

### Шаг 2. Запушьте код в ветку `main`

```bash
git add .
git commit -m "Deploy Megabot"
git branch -M main
git remote add origin https://github.com/<OWNER>/<REPO>.git
git push -u origin main
```

Если remote уже добавлен:

```bash
git push origin main
```

### Шаг 3. Включите GitHub Pages через Actions

1. Откройте репозиторий на GitHub.
2. Перейдите в **Settings → Pages**.
3. В блоке **Build and deployment** выберите:

```text
Source: GitHub Actions
```

4. Сохраните настройку.

Важно:

- не выбирайте Jekyll-тему;
- не создавайте второй Pages workflow из шаблона, если в репозитории уже есть `.github/workflows/pages.yml`;
- файл `.nojekyll` нужен, чтобы GitHub Pages не обрабатывал проект как Jekyll-сайт.

### Шаг 4. Запустите workflow публикации

Есть два варианта:

#### Автоматически

Сделайте push в `main`:

```bash
git push origin main
```

#### Вручную

1. Откройте вкладку **Actions**.
2. Выберите workflow **Deploy GitHub Pages**.
3. Нажмите **Run workflow**.
4. Выберите ветку `main`.
5. Нажмите **Run workflow** ещё раз.


### Как проверить, что в `main` попала правильная версия

GitHub Pages workflow в этом проекте деплоит только ветку `main`. Если изменения находятся в Pull Request, ветке `work`, `feature/*` или `codex/*`, опубликованный сайт всё ещё может показывать старую версию.

Проверьте локально:

```bash
git branch --show-current
git log --oneline -5
```

Проверьте на GitHub:

1. Откройте репозиторий → вкладка **Code**.
2. Выберите ветку **main**.
3. Убедитесь, что в `main` есть файлы `.nojekyll` и `scripts/smoke-render.mjs`.
4. Откройте `package.json` и проверьте, что `npm run check` содержит `scripts/smoke-render.mjs`.
5. Если этих файлов нет — Pull Request ещё не смержен. Нажмите **Merge pull request** или вручную перенесите изменения в `main`.
6. После merge откройте **Actions → Deploy GitHub Pages** и дождитесь нового зелёного run именно из ветки `main`.

Быстрая проверка опубликованного сайта:

```text
https://<OWNER>.github.io/<REPO>/src/app.js
https://<OWNER>.github.io/<REPO>/src/styles.css
https://<OWNER>.github.io/<REPO>/.nojekyll
```

Все три URL должны открываться без 404. Если `src/app.js` не открывается, страница будет показывать только fallback-текст из `index.html`.

Можно проверить опубликованный сайт одной командой:

```bash
npm run verify:pages -- https://<OWNER>.github.io/<REPO>/
```

Команда проверит `index.html`, `src/app.js`, `src/styles.css`, `data/memory.json` и `.nojekyll`. Если какой-то файл не опубликован или отдаёт 404, скрипт завершится с ошибкой и покажет проблемный asset.

### Шаг 5. Откройте опубликованное приложение

После успешного workflow GitHub покажет URL вида:

```text
https://<OWNER>.github.io/<REPO>/
```

Также URL можно найти здесь:

```text
Repository → Settings → Pages
```

---

## Если на GitHub Pages пустая страница

Проверьте по порядку:

1. **Открыт именно Pages URL**, а не HTML-файл внутри GitHub repository viewer.
   - правильно: `https://<OWNER>.github.io/<REPO>/`;
   - неправильно: `https://github.com/<OWNER>/<REPO>/blob/main/index.html`.
2. В **Settings → Pages** выбран `Source: GitHub Actions`.
3. Workflow **Deploy GitHub Pages** завершился зелёной галочкой.
4. В workflow был выполнен `npm run check` и `npm run build`.
5. В артефакте Pages есть файлы:
   - `index.html`;
   - `src/app.js`;
   - `src/styles.css`;
   - `data/memory.json`;
   - `.nojekyll`.
6. В браузере сделайте hard refresh:
   - Windows/Linux: `Ctrl + Shift + R`;
   - macOS: `Cmd + Shift + R`.
7. Откройте DevTools → Console. Если есть ошибка, сначала запустите локально:

```bash
npm run check
npm run build
npm run preview
```

В текущей версии приложение дополнительно показывает экран ошибки вместо полностью пустого экрана, если во время запуска произойдёт runtime-исключение.

---

## Настройка Groq API

Groq нужен для AI-чата в браузере и для GitHub Actions automation.

### Получение ключа

1. Откройте `https://console.groq.com/`.
2. Войдите или создайте аккаунт.
3. Перейдите в **API Keys**.
4. Создайте новый ключ.
5. Скопируйте значение.

### Вариант A: ключ только для браузера

1. Откройте приложение.
2. Перейдите в **Синхронизация**.
3. Вставьте ключ в поле **Groq API key**.
4. Нажмите **Сохранить**.

Ключ хранится только локально в IndexedDB/settings текущего браузера.

### Вариант B: ключ для GitHub Actions

Откройте:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Добавьте secret:

```text
GROQ_API_KEY
```

---

## Настройка Telegram-уведомлений

### 1. Создайте бота

1. Откройте Telegram.
2. Найдите `@BotFather`.
3. Отправьте команду:

```text
/newbot
```

4. Задайте имя и username.
5. Скопируйте токен бота.

Добавьте его в GitHub Secrets как:

```text
TELEGRAM_BOT_TOKEN
```

### 2. Получите Chat ID

1. Напишите любое сообщение своему боту.
2. Откройте URL, подставив токен:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

3. Найдите поле:

```json
"chat": { "id": 123456789 }
```

4. Добавьте значение в GitHub Secrets как:

```text
TELEGRAM_CHAT_ID
```

Для группового чата добавьте бота в группу, отправьте сообщение в группу и затем снова вызовите `getUpdates`. У групп часто отрицательный `chat.id`.

---

## GitHub Secrets

Откройте:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Добавьте:

| Secret | Обязателен | Для чего нужен |
| --- | --- | --- |
| `GROQ_API_KEY` | Для AI automation | Groq API в `daily-report.yml` и `notify.yml`. |
| `TELEGRAM_BOT_TOKEN` | Для Telegram | Отправка сообщений ботом. |
| `TELEGRAM_CHAT_ID` | Для Telegram | Чат, куда отправлять уведомления. |

Опционально:

| Secret | Для чего нужен |
| --- | --- |
| `PAGES_TOKEN` | Только если нужно автоматически включать Pages из workflow. Обычно достаточно вручную выбрать `Source: GitHub Actions` в Settings → Pages. |

---

## GitHub Actions workflows

### CI

Файл: `.github/workflows/ci.yml`

Запускается на push в `main`, pull request и вручную. Выполняет:

```bash
npm run check
npm run build
```

### Deploy GitHub Pages

Файл: `.github/workflows/pages.yml`

Запускается на push в `main` и вручную. Выполняет:

1. checkout;
2. setup Node.js;
3. `npm run check`;
4. `npm run build`;
5. upload Pages artifact из `dist/`;
6. deploy в GitHub Pages.

### AI Telegram reminders

Файл: `.github/workflows/notify.yml`

Запускается каждые 5 минут и вручную. Проверяет ближайшие задачи/события из `data/memory.json`, генерирует короткое AI-напоминание и отправляет его в Telegram.

### Daily cognitive report

Файл: `.github/workflows/daily-report.yml`

Запускается ежедневно и вручную. Создаёт AI-отчёт, сохраняет его в `data/memory.json`, коммитит обновление и отправляет отчёт в Telegram.

---

## Работа с памятью

### Где хранятся данные

В браузере:

- `tasks` — задачи;
- `notes` — заметки и дневник;
- `events` — расписание;
- `memories` — structured memory;
- `summaries` — compressed memory;
- `messages` — история AI-чата;
- `settings` — локальные настройки.

В репозитории:

- `data/memory.json` — переносимый snapshot для GitHub Actions и backup.

### Экспорт JSON

1. Откройте **Синхронизация**.
2. Нажмите **Скачать JSON**.
3. Сохраните файл как резервную копию.

### Импорт JSON

1. Откройте **Синхронизация**.
2. Нажмите **Импорт JSON**.
3. Выберите ранее сохранённый файл.

### Ручная выгрузка snapshot в GitHub

1. Создайте fine-grained GitHub token с доступом к репозиторию и правом **Contents: Read and write**.
2. Откройте **Синхронизация**.
3. Введите `owner/repo`.
4. Вставьте token.
5. Нажмите **Сохранить sync**.
6. Нажмите **Выгрузить snapshot**.

Токен хранится только локально в браузере. Не коммитьте его в репозиторий.

---

## Безопасность

- В коде нет production secrets.
- Не вставляйте ключи в `README.md`, issues, commits или screenshots.
- При утечке любого ключа сразу удалите его и создайте новый.
- Для ручной GitHub-синхронизации используйте fine-grained token с минимальными правами.
- Браузерный Groq key хранится только локально в IndexedDB/settings конкретного браузера.

---

## Полезные команды

```bash
# Dev server
npm run dev

# Проверка синтаксиса и smoke-render
npm run check

# Production build
npm run build

# Preview build
npm run preview
```
