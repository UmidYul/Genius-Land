# Документ H. Технические наблюдения, каталог API и обнаруженные проблемы

## 1. Стек (наблюдаемые признаки)
| Слой | Наблюдение | Уровень |
|---|---|---|
| Frontend | SPA на **React 18** + React Router v6 (флаги `v7_startTransition`), сборка **Vite** (`/assets/index-<hash>.js`, 167 lazy-чанков), состояние **Zustand** (persist: `auth-storage`, `school-storage`, `theme-storage`, `settings-storage`), **TanStack Query** (`vendor-query`), **react-hook-form** (`vendor-forms`), **axios**, **socket.io-client** (`vendor-socket`), собственная дизайн-система с префиксом `gl-` | П |
| Backend | REST `https://geniusland.uz/api/v1`, формат `{success, data, message / error, pagination}`; ORM в стиле **Prisma** (`_count`, include); **PostgreSQL**; версия 2.0.0; uptime ≈ 5 суток; Node.js (Г: по структуре и memory rss/heap) | П/Г |
| Auth | JWT access token (≈ 255 символов) и refresh token в localStorage; `Authorization: Bearer`; `POST /auth/refresh-token`; сессии устройств (`/sessions`) | П |
| Realtime | socket.io: `notification:new`, `new_message`, `message:deleted`, `messages:read`, `data:changed {domain}` → инвалидация кешей по доменам (finance, attendance, grades…) | П |
| Файлы | `/uploads/logos/*.webp`, `/media/:type/:id`, `/upload/avatar`, `/upload/file`, `/upload/student-avatar/:id`; лимиты 5 МБ (аватар) и 8 МБ (сторис) | П/ЧП |
| SMS | Провайдер **ESKIZ** (Узбекистан); шаблоны; баланс; тест | П |
| Платёжные шлюзы | Payme, Click, Uzum — есть в коде, сейчас выключены | П |
| Документы | Шаблоны договоров DOCX → PDF; PDF табелей, счетов, квитанций, билетов, рассадки | ЧП |
| Мобильное приложение | Есть (упоминания iOS / Android, подписание без OTP, удаление аккаунта, «прогресс-бар в мобильном приложении») | ЧП |
| Мультишкольность | Сущность School, `schoolId` у сотрудников, права `system.school.provision`; одна школа в проде; «филиал» (by-branch) в отчётах | ЧП |
| Часовой пояс | Даты в UTC; начало месяца = 19:00Z предыдущего дня (UTC+5, Ташкент) | П |
| Публичная часть | /apply (заявка с OTP), /exam/:token, проверка квитанций и договоров по QR, privacy / terms / support / account-deletion (требования магазинов приложений) | П |

## 2. Каталог API (≈ 1 000 операций)
Нотация: `:id` — параметр. Список собран из публичного фронтенда (вызовы `get/post/put/patch/delete`); фактическое поведение проверено только для отмеченных в E03 и для GET-запросов (только чтение).

### Auth и пользователи
- auth: POST login, logout, refresh-token, register, signup, forgot-password, reset-password, change-password; GET me.
- users: GET / , :id, profile, profile/preferences, search, stats, export, school/:id, :id/activity-log, :id/login-history; POST / , bulk, bulk-sms, :id/sms, :id/link-student, :id/link-teacher, migrate-gl-ids; PUT :id, :id/reset-password, :id/toggle-active, :id/toggle-verified, :id/unlock, bulk/status, profile, profile/password, profile/preferences; DELETE :id, bulk.
- sessions: GET / , stats, user/:id; DELETE :id, revoke-others, user/:id/revoke-all.
- admin/rbac/matrix (GET); activity-logs (GET, stats); upload (avatar, file, logo, student-avatar).

### Школа и система
schools (GET / , :id, :id/stats, directors/available, signature-asset/:id; POST / , :id/sync-stats, director-signature, stamp; PUT :id, :id/director; PATCH :id/settings; DELETE :id/logo, director-signature, stamp); settings (GET :key, backup, health, public, sms, storage, system; POST / , backup; PUT sms); setup (GET status, POST init); health; dashboard/* (stats, activities, attendance-trend, birthdays, class-performance, grade-distribution, sms-stats, today-schedule, top-students); management/overview; approvals (queue, summary).

### Люди
- students: GET / , :id, :id/enrollments, birthdays, class/:id, export, export/xlsx, export/financial-xlsx, search, stats; POST / , bulk, import, :id/create-account; PUT :id, :id/status, :id/transfer, bulk/status, bulk/transfer; DELETE :id, bulk/delete.
- student-archive: GET archived, :id/archive-history, :id/settlement-preview; POST :id/archive, :id/restore, :id/settle, bulk-graduate.
- parents: GET / , :id, report/synthetic-phones; POST / , :id/link-student; PUT :id; DELETE :id, :id/unlink-student/:sid, bulk/delete.
- guardian-authorities: GET, POST, bulk-grant, PATCH :id, DELETE :id.
- teachers: GET / , :id, stats; POST; PUT :id, :id/status, :id/subjects; DELETE :id.
- employees: GET / , :id, :id/documents, :id/finance-profile, attendance, attendance/my, expiring, leaves, leaves/my, leaves/stats, my-finance-profile, my-leave-summary, my-profile, payroll/list, payroll/summary, stats; POST / , :id/documents, :id/terminate, attendance/mark, bulk/payroll, bulk/salary, bulk/status, create-from-user/:uid, leaves, leaves/request, payroll/generate; PUT :id, :id/salary, payroll/:id; PATCH leaves/:id/approve | cancel | reject, payroll/:id/pay; DELETE :id, :id/documents/:doc, payroll/:id.
- hr: applicants (GET, POST, PATCH :id/stage, POST :id/hire), certifications (CRUD + file), contracts (CRUD, employee/:id, expiring, :id/amendments, file), departments, positions, staffing-table (+ vacant), vacancies (CRUD), leave-balances (GET, POST, PATCH :id/adjust), leave-plans (CRUD, PATCH status), timesheets (GET, matrix, POST generate, PATCH :id/approve, :id/lock), work-schedules (POST, GET employee/:id, DELETE), reports (GET, :code).

### Учебная структура и процесс
- academic-years: CRUD, current, PUT :id/set-current.
- classes: GET / , :id, :id/students, :id/split-coverage, available-teachers, grade/:n, stats; POST / , :id/groups/split; PUT :id, :id/teacher; DELETE :id, bulk/delete.
- groups: GET / , :id, journal; POST / , :id/students; PUT :id, :id/schedule, :id/students/move, :id/subjects; DELETE :id, :id/students/:sid.
- subjects: GET / , :id, grade/:n, stats; POST; PUT :id, :id/teachers; DELETE.
- schedules: GET / , :id, available-teachers, class/:id, conflicts, day/:day, lesson-times, room-conflicts, stats, teacher/:id; POST / , class/:id/bulk, copy, resolve, resolve-preview; PUT :id; DELETE :id.
- journal: GET classes, data, export, lesson-days.
- attendance: GET / , class/:id/date/:d, class/:id/monthly | stats | weekly, lessons, lessons/:id, student/:id/history, today-summary; POST / , bulk, class/:id/notify, lessons/mark; DELETE :id.
- absence-permits: GET / , :id, daily-rate/:sid, deductions/list, deductions/summary; POST / , :id/review, deductions/apply; PUT :id, settings/deduction; DELETE :id.
- grades: GET / , :id, class/:id/quarters, class/:id/stats, class/:cid/subject/:sid/gradebook; POST / , bulk, notify, notify/bulk; PUT :id; DELETE :id.
- academic: GET analytics/classes | subjects, annual-grades, classes/:id/enrollments, dashboard, grade-policies (+ effective), grades/:id/history, promotions (+ :id), report-cards (+ :id, :id/pdf), students/:id/enrollments | status-history, term-grades; POST annual-grades/:id/approve, annual-grades/bulk-calculate, enrollments/transfer, grade-policies, promotions (+ :id/approve | execute | rollback | validate), report-cards/annual | bulk | quarter, students/:id/status, term-grades/:id/approve | lock | reopen, term-grades/bulk-calculate; PATCH promotions/:id/decisions, term-grades/:id; PUT / DELETE grade-policies/:id.
- homework: GET / , :id, :id/missing, :id/submissions, analytics, overdue-students, statistics; POST / , :id/bulk-grade, :id/record, :id/submit, submissions/:id/grade; PUT :id; PATCH :id/publish; DELETE :id.
- exams: GET / , :id, :id/attempts (+ :aid), :id/missing-students, :id/questions, :id/results (+ export), analytics, export, statistics; POST / , :id/auto-grade, :id/notify-all, :id/questions, :id/start, attempts/:id/grade | notify | submit; PUT :id, questions/:id; PATCH :id/publish, :id/questions/reorder, :id/status; DELETE :id, questions/:id.
- teacher-portal: GET dashboard, lesson, my-schedule, my-students, today; POST attendance (+ bulk), grades (+ bulk), homework, lesson/save.
- student-portal: GET attendance, coins, dashboard, grades, homework, schedule.
- parent-portal: GET admissions (+ :id), announcements, children/:id (+ attendance | discipline | exams | grades | homework | schedule), dashboard, events, notifications, payments, profile; POST admissions/:id/documents, admissions/offers/:id/respond; PUT profile; PATCH notifications/:id/read, read-all.

### Поощрения и дисциплина
gamification: GET achievements (+ :id, student/:id), analytics, awarders, balance/:id, challenges (+ :id/leaderboard, all, progress/:id), charter, coins/daily-usage, integrity, leaderboard (+ class/:id), rewards (+ purchases), stats, transactions; POST achievements (+ award, revoke), catalog/seed, challenges (+ complete), coins/award | bulk-award | void | void-batch, rewards (+ purchase); PUT achievements/:id, challenges/:id, rewards/:id, rewards/purchases/:id/cancel | deliver; DELETE achievements, challenges, rewards.
family-missions: catalog (CRUD), completions (GET), completions/:id/review.
discipline: GET / , :id, analytics, charter, export, high-risk, moral-score/:sid, moral-score/class/:cid, stats, student/:sid; POST / , :id/notify, moral-score/reset, notify-bulk; PUT :id; PATCH :id/status; DELETE :id.

### Финансы
fee-types (CRUD, toggle, assign, student/:sid, DELETE student/:sid/:fid, `force=true`); discounts (CRUD, toggle, assign, export, financial-profile/:sid (+ update), financial-profiles/update-all, pending, report, student/:sid, student-discount/:id/approve | reject | revoke | history, student-discount/bulk-approve); invoices (GET / , :id, :id/pdf, stats; POST :id/payment, bulk-delete, custom, generate-monthly, student, update-overdue; PUT :id; PATCH :id/cancel, :id/send; DELETE :id); payments (GET / , :id, :id/history, :id/receipt, receipt/:no, stats, student/:sid, summary, verify/:id; POST / , :id/cancel, :id/partial, :id/process, class/:cid/bulk, quick-payment, update-overdue; PUT :id; DELETE :id); payment-gateway (gateway/status, payment/:id/links); expenses (CRUD, approval-threshold, pending-approvals, stats, approve / cancel / pay / reject); finance/* (accounts/reconcile (+ fix), activities, analytics (+ period), automation/logs | settings | stats | generate | generate-full | preview | update-overdue, bank/accounts (+ statements), budget (+ execution), cashbox/closings | current | open | close | transaction, cashboxes, cashier-report, cashiers, class/:id/stats, creditors, daily-report, dashboard/stats, debtors (+ bulk-delete, DELETE :id), export/* (class-financial-report, creditors, debtors, expenses, invoices-xlsx, payments), payroll (+ :id/breakdown, engine-status, summary), receipt/:id, reconcile-all, reconciliation (+ :id/complete, items match / unmatch, :id/unmatched), reports/export, send-reminders, student/:id/financial-summary | history | reconcile, students/:id/account (+ sync), summary/monthly).

### Договоры
contracts (GET / , :id, :id/addenda | amendments | amendments/:a/document | audit | deliveries | document | signature-evidence/:s | signers, finance-preview, stats, status/transitions; POST / , :id/addenda, :id/amendments (+ apply | approve | generate | sign), :id/approve | cancel | decline | generate | remind | request-changes | school-sign | validate, :id/signature/start | verify | face | complete, :id/signature/in-person/start | face | complete, bulk-cancel, export-zip; PATCH :id; DELETE :id); contract-templates (GET / , :id, :id/source-docx, tokens; POST / , :id/versions, versions/:v/preview | publish; PATCH :id, versions/:v); contract-campaigns (GET / , :id, :id/progress; POST / , :id/generate | preview | retry-failed | send | validate); contract-enforcement (GET cases, cases/:id, settings, summary; POST cases/:id/approve | reject, run; PUT settings); contract-years (GET :y/close-preview, :y/renewal-candidates; POST :y/close, :y/renewal-campaign); contract-reports (GET types, :key).

### Приём
admissions: dashboard; leads (CRUD, check-duplicate, :id/assign, :id/stage, :id/convert); interactions; tasks (CRUD, :id/complete); slots (+ :id/book); siblings; applications (CRUD, :id/status-history, change-status, contract, issue-contract, convert, decision, documents, interviews / interview, offers, payments, sibling); documents/:id/review; interviews/:id/result; offers/:id/send | respond; payments/:id/refund; exams (CRUD, :id/assign | assignments | publish | questions | seating.pdf); exam-assignments/:id/result; intakes (CRUD, toggle); waitlist (+ promote | recompact | reorder); lead-scoring/settings (+ backfill, reset); reports (+ :key); status/transitions; public (intakes, otp/request, otp/verify, application, track, exam/:token, exam/:t/draft | start | submit).

### Сервисы
transport: analytics, assignments (CRUD), boardings/summary, documents/expiring, drivers, export, routes (CRUD, :id/stops CRUD, stops/reorder, :id/tariff), stats, student/:id, students/:id/boardings, tariffs (default, resync), trips (CRUD, generate, :id/start | complete | delay | cancel, :id/manifest, :id/boarding (+ bulk, scan), :id/boardings), vehicles (CRUD, toggle, :id/documents CRUD, :id/schedule), send-notifications; driver-portal (my-day, my-vehicle, trips/:id/manifest); tickets (GET / , :id, :id/pdf, student/:id, verify/:no; POST; PATCH :id/cancel).
library: analytics, books (CRUD, lookup, :id/cover, :id/write-off), borrow, borrowings (+ :id/late-fee | receipt | receipt/pdf | lost | renew, student/:id), categories, export, inventory/idle, policy, popular, return/:id, send-reminders, stats.
cafeteria: categories, dishes, meal-times (+ reorder), menus (+ :id/items, :id/publish, copy-week, publish-week), menu/today, menu/weekly, kitchen-sheet, consumption-report, statistics, export/consumption | dishes | weekly-menu.

### Коммуникации
messages: analytics, attachments/:id, conversations (CRUD, :id/messages (+ attachment, voice), :id/media | pinned | export | mute | read | leave, participants (+ admin)), messages/:id (PUT, DELETE, forward, pin, report), search, search-users, unread, users, broadcast.
notifications: GET / , analytics, devices, export, preferences, quiet-hours, sent (+ :id/delivery), sms-templates, templates, unread-by-type, unread-count; POST / , audience/preview, send, send-from-template, send-to-class, send-to-school, sms-templates/seed; PATCH :id, :id/read | unread, read-all, read-many, sms-templates/:id; PUT preferences, quiet-hours; DELETE :id, clear/old, clear/read, devices/:id, sent/batch.
announcements (CRUD, archive / unarchive, publish / unpublish, toggle-pin, duplicate, attachments, read-stats, export, statistics); news (CRUD, comments, comments-enabled, comments/:id/visibility, media/preview | upload); stories (GET, POST, :id/comment | like | view, comments, DELETE); events (CRUD, calendar, conflicts, staff-calendar, statistics, types, upcoming, week, :id/status); moderation (queue, reports/:id); sms (analytics, balance, config, history (+ export), providers, send, test); tickets.

### Отчёты
reports: attendance/daily | monthly, class-comparison, comprehensive (+ export), finance/debts | payments, grades/class | group | student/:id, overview, ranking/class | group/:id, teacher-performance, transcript/:id (+ export), catalog, `/reports/:code` (диспетчер 23 отчётов).

## 3. Обнаруженные проблемы (баги и риски)

| ID | Описание | Шаги / доказательство | Ожидание | Факт | Влияние | Приор. | Исправление в новой системе |
|---|---|---|---|---|---|---|---|
| ISS-01 | Сервер принимает переплату сверх остатка счёта | E03 T-FIN-11 | Отклонить или явно оформить аванс | paidAmount > total | Неверные отчёты по счетам | Высокий | Платёж распределяется по счетам, излишек — в аванс на лицевом счёте |
| ISS-02 | Долг и переплата не сальдируются: ученик одновременно должник и кредитор | T-FIN-17 | Один баланс | Два списка | Ошибочные напоминания должникам и обзвон | Критический | Единый леджер, долг = сальдо; автозачёт аванса в новые счета |
| ISS-03 | Кредит не зачитывается в новый счёт | T-FIN-15 | Автоаллокация | Нет | Ручная работа, ошибки | Высокий | Аллокация FIFO при выставлении |
| ISS-04 | Скидка > 100 % разрешена | T-FIN-19 | ≤ 100 % | 150 % принято | Отрицательные счета | Высокий | Валидация 0 < p ≤ 100 |
| ISS-05 | Отрицательная сумма тарифа | T-FIN-02 | ≥ 0 | −5 принято | Отрицательные начисления | Высокий | CHECK amount ≥ 0 |
| ISS-06 | Оценка больше максимума и 0/1 по 5-балльной шкале | T-GRD-02/04 | 2..5 (или 0..max) | 6/5 = 120 % | Искажение средних и монет | Средний | Валидация шкалы из политики |
| ISS-07 | Дата рождения ученика в будущем | T-STU-07 | Отклонить | Принято | Мусорные данные, неверный возраст | Средний | Проверка возраста 2..20 |
| ISS-08 | Класс: gradeLevel 13 и capacity 0 → 30 | T-CLS-02/03 | 400 | 201 | Мусор, скрытые подмены | Средний | Явные проверки, без подмены falsy-значений |
| ISS-09 | Неверный порядок проверок при создании ученика (ошибка вместимости вместо «ФИО и класс обязательны») | T-STU-04 | Сначала обязательные поля | Ошибка вместимости 30 | Путает пользователя | Низкий | Схемная валидация до бизнес-проверок |
| ISS-10 | Нет проверки дублей учеников | T-STU-08 | Предупреждение по ФИО + дате рождения / ПИНФЛ | Дубль создан | Двойные счета | Средний | Мягкая проверка дублей + уникальный ПИНФЛ |
| ISS-11 | Создание ученика не пишет историю движения (ADMITTED) | T-STU-09 | Запись ADMITTED | Пусто | Неполная история и отчёты | Средний | Событие при создании |
| ISS-12 | Нет пропорции при зачислении в середине месяца (а при выбытии есть) | T-FIN-23/24 | Единая политика | Асимметрия | Споры с родителями | Средний | Настраиваемая политика пропорции |
| ISS-13 | Номер счёта по месяцу создания, а не периода | T-FIN-15 | По периоду или нейтральный | INV-2610 для ноября | Путаница | Низкий | Нейтральная последовательность |
| ISS-14 | Счёт с прошедшим сроком создаётся в статусе PENDING | T-FIN-07 | OVERDUE сразу | PENDING до запуска процесса | Неверные отчёты | Низкий | Статус вычисляется на лету |
| ISS-15 | Две формулы удержаний за болезнь (месяц / 22 и фикс 35 000) | daily-rate, finance-preview | Одна | Две | Расхождение сумм | Средний | Одна настраиваемая |
| ISS-16 | Сетка звонков ≠ время уроков в расписании | lesson-times vs дашборд | Согласованность | 08:00 vs 08:30 | Путаница | Низкий | Время урока только из сетки |
| ISS-17 | 21 конфликт учителей в расписании | /schedules/conflicts | 0 | 21 | Срыв уроков | Высокий (данные) | Блокировать сохранение конфликтов |
| ISS-18 | Четверти не созданы → итоговые оценки невозможны | academic-years | Четверти на год | 0 | Нет табелей | Высокий (данные) | Создание четвертей в мастере года |
| ISS-19 | Посещаемость заполняется на ~13 % (83 из 629) | дашборд | ~100 % | 13 % | Неверная статистика | Высокий (процесс) | Контроль заполнения, напоминания |
| ISS-20 | Разный формат ответов: `message` vs `error`; пагинация `pagination` / `meta` / `{items,total}` / голый массив; `limit` игнорируется в /groups и /schedules | API | Единый формат | Разнобой | Сложность клиента | Низкий | Единый конверт ответа |
| ISS-21 | Пароль: ≥ 6 в одних формах, ≥ 8 с классами символов в других | E02 | Единая политика | Разная | Безопасность | Средний | Единая политика |
| ISS-22 | Роль TRANSPORT_MANAGER есть в отчётах, но не в RBAC | reports/catalog | Согласованность | Нет роли | Отчёт недоступен | Низкий | Единый реестр ролей |
| ISS-23 | Доступ к страницам (allowedRoles) не совпадает с серверными правами | G §5 | Из прав | Дублирование | Ошибки доступа | Средний | Вывод меню из прав |
| ISS-24 | Категории тарифов различаются по экранам (MEAL / MEALS / CAFETERIA, ACTIVITY / EXTRA_CLASS / EXTRACURRICULAR) | E01 | Один справочник | Несколько | Ошибки отчётов | Средний | Единый enum |
| ISS-25 | Нет возврата (refund) оплаченного платежа — только удаление | T-FIN-14 | Сторно с аудитом | Удаление | Потеря следа | Высокий | Операция «сторно / возврат» |
| ISS-26 | SMS: сбой отправки кода сброса пароля | SMS-лог | Доставка | 1 ошибка | Пользователь не может войти | Средний | Повторы, мониторинг баланса |

## 4. Безопасность (наблюдения, без попыток обхода)
- Токены хранятся в localStorage (уязвимость к XSS); в новой системе — httpOnly-cookie или короткоживущий access + ротация refresh.
- Есть блокировка после неудачных входов, история входов, управление сессиями, аудит с old/new data — **хорошая практика, сохранить**.
- RBAC с областями (OWN / CLASS / SUBJECT) и защитой от повышения привилегий — сохранить.
- Отчёты помечены `hasPii`; у пользователя флаг `canSeePii`.
