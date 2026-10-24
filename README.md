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
pnpm db:seed                # (необязательно) демо-данные
pnpm dev                    # кабинет: http://localhost:3000 (→ /uz), воркер — параллельно
```

Язык выбирается в адресе: `/uz/...` (по умолчанию) и `/ru/...`.

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
