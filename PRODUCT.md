# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Сотрудники работают в браузере и с телефона, и с компьютера, поэтому каждый сценарий сотрудника должен полностью работать на ширине телефона и на десктопе.

Родители и ученики **не имеют страниц на сайте**. Они взаимодействуют со школой только через:
- **мобильное приложение** (разрабатывается позже, платформа не выбрана — native или web);
- **Telegram-бот** (уведомления, расписание, коды входа);
- SMS и e-mail (как дополнительные каналы, см. «Уведомления»).

Веб-платформа должна сразу отдавать API, которое потом переиспользует приложение.

## Stack

Delegated: **Next.js (App Router) + TypeScript, PostgreSQL via Prisma, and next-intl for Uzbek/Russian.** Why: one codebase serves the staff web app now and can expose an API for the parent/student app and the Telegram bot later. Role-based access and server-rendered pages suit a data-heavy internal tool. PostgreSQL fits the relational shape of the data (branches, students, classes, groups, subjects, grades, payments). Hosting target is undecided.

## School

**Genius Land** — частная общеобразовательная школа в Узбекистане (Маргилан; адреса обоих филиалов — уточнить).

- **Два филиала.** Данные каждого филиала изолированы; видеть оба может только основатель (и суперадмин на техническом уровне).
- **Около 700–800 учеников** в сумме по обоим филиалам.
- **Классы с 1-го по 11-й.**
  - **1–7 классы** — как в обычной школе: класс (например «5-А») учится вместе по общей программе.
  - **8–11 классы** — учатся только в **группах по направлениям** («ЭКОНОМИКА 1», «МЕДИЦИНА 2», «ФИЛОЛОГИЯ 1»). Группа — это **полноценный класс**: свой состав, свой классный руководитель, своё расписание и журнал, свои целевые предметы. В одной группе сидят ученики разных возрастов (8–11 класс). Номер класса ученика (8, 9, 10, 11) хранится только как атрибут — «для вида», учебной единицей он не является.
- **У каждого класса и каждой группы есть классный руководитель.**
- **Учебный день с 8:00 до 17:00.**
- **Учебная неделя:** 1–7 классы — пн–пт; группы 8–11 — пн–сб, в субботу до обеда.
- **Питание:** завтрак, обед и полдник.
- **Свой школьный автобус.**
- **Раз в месяц — поездка в другой город.**
- Обучение на русском языке; интерфейс — узбекский (латиница) и русский.

## Users

### Роли v1

| Роль | Область данных | Кратко что делает |
|---|---|---|
| **Основатель** | Оба филиала | Видит все данные обоих филиалов, сводки и сравнение филиалов. Утверждает важные решения (не каждую мелочь) — список типов утверждений настраивается |
| **Директор** | Только свой филиал | Руководит филиалом: учебная часть, сотрудники, контроль финансов и отчёты |
| **Администратор** | Только свой филиал | Операционная работа: классы, группы, предметы, расписание, назначения учителей, ученики и родители |
| **Учитель** | Свои классы, группы и предметы | Журнал: оценки, темы уроков, посещаемость — с телефона во время или сразу после урока и с компьютера |
| **Бухгалтер** | Филиалы, назначенные пользователю (один или оба) | Договоры на обучение, ежемесячная плата, платежи, долги |
| **Суперадмин** | Система | Пока только базовые технические функции: пользователи и роли, филиалы, справочники, настройки, журнал действий |
| **Родитель** | Только свои дети | Без страниц на сайте — только приложение и Telegram-бот |
| **Ученик** | Только свои данные | Без страниц на сайте — только приложение и Telegram-бот. Телефоны в школе запрещены, использует дома |

### Роли позже (не v1)
- **Отдел кадров** (HR).
- **Завхоз.**

Модель прав должна позволять добавлять роли без переделки: право = действие над ресурсом + область видимости (система / все филиалы / филиал / свои классы-группы-предметы / свои записи или свои дети). Меню, страницы и API выводятся из прав, а не из отдельных списков.

## Product Purpose

An in-house school management platform that does for Genius Land what e-maktab.uz does for state schools: an electronic journal plus school administration in one place, for both branches. It replaces paper journals and scattered records with one source of truth for academic and financial data. Success means teachers fill the journal quickly on whatever device they have, the founder, directors, administrators and the accountant see accurate, current records, and parents and students get timely notifications and an always-current schedule through the Telegram bot now and the app later.

## Positioning

Built for one private school with two branches, not a generic multi-school system. It covers what a private school needs and a state e-journal doesn't: tuition contracts, fees, and debts sit next to grades and attendance, and the 8–11 direction groups are first-class. It fits Genius Land's own classes, groups, timetable, and roles exactly.

## Operating Context

- Teachers use it in short bursts between and after lessons, often one-handed on a phone, and in longer desktop sessions in the staff room.
- Academic work follows the Uzbek school structure: grades 1–11, parallel classes, subjects, a weekly timetable, academic quarters, and a school year — plus direction groups for grades 8–11.
- School day runs 8:00–17:00 (Asia/Tashkent).
- Instruction and academic content are in Russian. The interface must be available in Uzbek and Russian.
- Familiar reference: e-maktab.uz, the state electronic journal staff and parents in Uzbekistan already know.

## Notifications

Каналы: **Telegram-бот (основной)**, SMS, e-mail, позже push в приложении.

- **Telegram-бот — основной канал.** Предупреждения, уведомления, события, оценки/пропуски и т.п. идут прежде всего в бот.
- **Коды аутентификации** и другие критичные сообщения — **всегда** во все подключённые у пользователя способы, включая SMS.
- **SMS — редко.** Только для редких, но важных вещей: в первую очередь напоминания об оплате. SMS платные — не дублировать в них всё подряд.
- **E-mail** — дополнительный канал.
- **Расписание в боте:** бот показывает расписание **только на сегодня и на завтра**. Данные берутся из базы в момент запроса (без устаревших копий), чтобы замены и изменения сразу были видны.

## Capabilities and Constraints

V1 modules:
1. **Филиалы и роли**: два филиала, роли из таблицы выше, изоляция данных по филиалу.
2. **Journal and grades**: per class/group and subject, grades and lesson topics.
3. **Attendance**: absences and lateness.
4. **Schedule, classes and groups**: timetable, classes (1–7), direction groups (8–11), subjects, teacher assignments, student roster.
5. **Tuition and payments**: contracts, monthly fees, payments, debts.
6. **Notifications and Telegram bot**: channel routing above, schedule for today/tomorrow.
7. **Дисциплина — только основа**: модель данных и права закладываются в v1, интерфейс и автоматика — в v2.

Подробный план v1, этапы и промты для реализации — `docs/v1/PLAN.md`.

Constraints:
- Bilingual UI: Uzbek (Latin script) and Russian.
- Scale: one school, two branches, about 700–800 students in total, several parallel classes per grade.
- Data shape and access should let the future parent/student app reuse them.
- Every branch-owned record carries its branch; nobody except the founder (and superadmin for technical tasks) sees another branch's data.

Not in v1 (context only, may come later): HR, завхоз, питание (меню/учёт), автобус (маршруты/учёт), ежемесячные поездки, мобильное приложение.

Open decisions (do not assume — ask Umid):
- Адреса/названия филиалов.
- Суперадмин: точный набор «базовых функций».
- Сетка звонков (время уроков) и во сколько заканчивается суббота у групп 8–11.
- Grading scale and how quarter/year grades are calculated.
- Whether attendance is marked per lesson or per day.
- Fee structure (monthly vs. other periods, discounts, siblings), входят ли питание/автобус/поездки в плату, payment methods, and any integrations (e.g. Click, Payme).
- Homework, announcements, and messaging: not in v1 scope unless added.
- SMS provider, hosting/deployment target.
- Parent/student app platform and timeline.

## Brand Commitments

- Name: **Genius Land**.
- Domain: **geniusland.uz** moves from the old site to this platform.
- **Colors**: taken from the current geniusland.uz — green brand `#0EA17B`, light and dark themes. Full token list: `docs/BRAND.md`.
- **Fonts**: Sora (headings) and Manrope (body), confirmed.
- **Logo**: `src/images/brand/logo-genius-land.jpg`. Must be used.

## Evidence on Hand

- `Legacy Website Audit/` — аудит старого сайта geniusland.uz (функции, правила, роли, ошибки). Только справочник: правила использования — в `CLAUDE.md`.
- No real data or assets are in the repository yet. The logo is pending.
- Do not invent student names, grades, payment figures, or school statistics as if they were real. Clearly mark any placeholder data as such.

## Product Principles

1. **Fast entry over feature breadth.** Recording a lesson's grades and attendance should take seconds on a phone. Daily teacher actions get priority.
2. **One source of truth.** Academic and financial records live together and agree with each other. No duplicate entry across modules.
3. **Branch isolation by default.** A user sees only their branch unless their role says otherwise.
4. **Familiar to Uzbek school staff.** Follow the conventions staff already know from e-maktab and paper journals before inventing new ones.
5. **Bilingual from day one.** Uzbek and Russian are equal. No hard-coded strings, and layouts must survive the longer of the two.
6. **Built for the parents' app later.** Model data and permissions now so parent and student access is an extension, not a rewrite.
7. **Telegram first, SMS sparingly.** Route messages to the bot by default; spend SMS only on rare, important messages.
