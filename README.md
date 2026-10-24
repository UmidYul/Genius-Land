# Genius Land

Платформа управления частной школой Genius Land: электронный журнал, администрирование, оплата обучения и уведомления (Telegram-бот, SMS, e-mail) для двух филиалов.

- Что делаем и для кого — [`PRODUCT.md`](PRODUCT.md).
- План v1, архитектура и этапы — [`docs/v1/PLAN.md`](docs/v1/PLAN.md).
- Бренд (цвета, шрифты, логотип) — [`docs/BRAND.md`](docs/BRAND.md).
- Правила работы в репозитории — [`CLAUDE.md`](CLAUDE.md).

## Стек

Next.js (App Router) + TypeScript, PostgreSQL 16 + Prisma, next-intl (uz/ru), Tailwind CSS, pg-boss для фоновых задач. pnpm-монорепо.

```
apps/web        кабинет сотрудников + /api/v1
apps/worker     фоновые задачи (pg-boss); позже — Telegram-бот
packages/core   бизнес-логика: результат/ошибки, деньги, время, аудит, настройки
packages/db     Prisma: схема, миграции, клиент, сид
packages/i18n   словари uz (латиница) / ru
packages/ui     дизайн-система: токены и базовые компоненты
```

## Локальный запуск

Нужно: Node.js 22+, pnpm 9 (`corepack enable` или `npm i -g pnpm@9`), Docker.

```bash
cp .env.example .env        # переменные окружения (значения по умолчанию подходят для Docker)
pnpm i                      # зависимости + генерация Prisma Client
docker compose up -d        # PostgreSQL 16: базы genius_land и genius_land_test
pnpm db:migrate             # применить миграции
pnpm db:seed                # права, роли, филиалы и демо-пользователи
pnpm dev                    # кабинет: http://localhost:3000 (→ /uz), воркер — параллельно
```

Язык выбирается в адресе: `/uz/...` (по умолчанию) и `/ru/...`.

В `.env` задайте `AUTH_SECRET` — случайную строку не короче 32 символов (команда для генерации — в `.env.example`).

### Демо-входы (только для разработки)

Сид создаёт по одному демо-пользователю на роль. Пароль сотрудников — `demo12345`.

| Телефон | Роль |
|---|---|
| +998 00 000 00 01 | Суперадмин |
| +998 00 000 00 02 | Основатель |
| +998 00 000 00 03 | Директор (основной филиал) |
| +998 00 000 00 04 | Директор (филиал) |
| +998 00 000 00 05 | Администратор |
| +998 00 000 00 06 | Учитель |
| +998 00 000 00 07 | Бухгалтер (оба филиала) |

Вне production сид также создаёт демо-школу в основном филиале: учебный год, класс 5-А, группу «ЭКОНОМИКА 1», учеников и родителя — всё помечено «(демо)».

При входе с нового устройства нужен код. Пока SMS и e-mail не подключены, код печатается в консоль `pnpm dev` (строка вида `[SMS → +998000000003] …`).

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | web (Next.js, порт 3000) и worker в режиме разработки |
| `pnpm build` | production-сборка web и worker |
| `pnpm lint` / `pnpm lint:fix` | ESLint (в т. ч. запрет захардкоженного текста в интерфейсе) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm typecheck` | TypeScript во всех пакетах |
| `pnpm test` | Vitest: unit + интеграционные (нужна тестовая БД) |
| `pnpm test:unit` / `pnpm test:int` | только unit / только интеграционные |
| `pnpm test:e2e` | Playwright smoke (сам поднимает dev-сервер); перед первым запуском: `pnpm exec playwright install chromium` |
| `pnpm db:migrate` | применить миграции (`prisma migrate deploy`) |
| `pnpm db:migrate:dev --name <имя>` | создать новую миграцию после изменения схемы |
| `pnpm db:seed` | сид (идемпотентный) |
| `pnpm db:studio` | Prisma Studio |

Интеграционные тесты работают с отдельной базой `DATABASE_URL_TEST` и очищают таблицы — никогда не указывайте в ней рабочую базу.
