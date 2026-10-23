# Документ G. Роли и права доступа

Источник (уровень: **Подтверждено**): ответ `GET /api/v1/admin/rbac/matrix` под ролью SUPER_ADMIN, сгенерирован сервером 2026-10-23T18:11Z, а также карта маршрутов фронтенда (`allowedRoles`) из публично загружаемого JS-бандла `/assets/index-*.js`. Права других ролей **не проверялись входом под этими ролями**: это заявленная сервером конфигурация, а не результат тестов.

## 1. Модель RBAC (как устроено)

- Разрешение = `module.resource.action`, например `finance.payment.reverse`.
- Поля разрешения: `code`, `module`, `resource`, `action` (view/create/edit/delete/manage/approve/export), `description`, `defaultScope`.
- **Scope (область действия)**: `GLOBAL` (вся система), `SCHOOL` (своя школа), `CLASS` (свои классы), `SUBJECT` (свои предметы), `OWN` (только свои записи или записи своего ребёнка).
- Роли получают набор `grants: [{code, scope}]`. Всего **226 разрешений** и **37 ролей**.
- Мультишкольность: есть `system.school.provision` (создать школу, назначить директора), сущность `School`. Сейчас в системе одна школа.
- Есть права на «дополнительную роль» (`users.role.assign`), т.е. у пользователя может быть основная роль и дополнительные.
- Есть защита от повышения привилегий: при создании пользователя отдельно проверяется, какую роль можно выдать (из описания `users.account.create`).

### 1.1 Модули разрешений
`system`, `users`, `students`, `hr`, `academics`, `grades`, `attendance`, `finance`, `contracts`, `admissions`, `services`, `comms`, `reports`.

## 2. Роли (37)

| Код роли | Название в UI | Стартовая страница | Кол-во прав |
|---|---|---|---:|
| SUPER_ADMIN | Super Admin | /dashboard | 222 |
| ADMIN | Administrator | /dashboard | 213 |
| DIRECTOR | Direktor | /dashboard | 193 |
| VICE_DIRECTOR | Заместитель директора | /deputy/dashboard | 88 |
| DEPUTY_ACADEMIC | Зам. по учебной части | /deputy/dashboard | 65 |
| DEPUTY_DISCIPLINE | Зам. по воспитательной работе/дисциплине | — | 52 |
| DEPUTY_GENERAL | Зам. по общим (хоз.) вопросам | — | 43 |
| DEPUTY_INNOVATION | Зам. по инновациям | — | 40 |
| HEAD_TEACHER | Завуч / старший учитель | /deputy/dashboard | 55 |
| METHODOLOGIST | Методист | /deputy/dashboard | 47 |
| TEACHER | O'qituvchi | /teacher/today | 64 |
| ASSISTANT_TEACHER | Ассистент учителя | — | 33 |
| LAB_ASSISTANT | Лаборант | — | 26 |
| STUDENT | O'quvchi | /student/dashboard | 37 |
| PARENT | Ota-ona | /parent/dashboard | 46 |
| ACCOUNTANT | Hisobchi | /accountant/dashboard | 81 |
| CHIEF_ACCOUNTANT | Главный бухгалтер | — | 77 |
| CASHIER | Kassir | /accountant/dashboard | 43 |
| ECONOMIST | Экономист | — | 39 |
| REGISTRAR | Ro'yxatchi (регистратор/приёмная) | /registrar/dashboard | 96 |
| SECRETARY | Секретарь | /registrar/dashboard | 48 |
| HR_MANAGER | Менеджер HR | /hr/dashboard | 45 |
| HR_OFFICER | Специалист HR | /hr/dashboard | 30 |
| IT_SPECIALIST | IT-специалист | — | 33 |
| LIBRARIAN | Kutubxonachi | /library | 31 |
| HEAD_OF_FACILITIES | Завхоз | — | 34 |
| MEDICAL_OFFICER | Врач | — | 31 |
| NURSE | Медсестра | — | 27 |
| PSYCHOLOGIST | Психолог | — | 32 |
| SOCIAL_WORKER | Соц. работник | — | 31 |
| SECURITY | Охрана | — | 26 |
| WATCHMAN | Сторож | — | 23 |
| CLEANER | Уборщик | — | 22 |
| GARDENER | Садовник | — | 22 |
| COOK | Повар | /cafeteria | 25 |
| CAFETERIA_STAFF | Сотрудник столовой | /cafeteria | 23 |
| DRIVER | Водитель | /driver/today | 26 |

Если стартовая страница для роли недоступна (по `allowedRoles`), пользователь попадает на `/me`.

## 3. Базовые наборы прав

**BASE (есть у всех 37 ролей, 16 прав):**
`users.profile.view@OWN, users.profile.edit@OWN, system.school.view, comms.message.view@OWN, comms.message.send@OWN, comms.conversation.moderate@OWN, comms.directory.view@OWN, comms.moderation.report@OWN, comms.notification.view@OWN, comms.announcement.view, comms.event.view, comms.story.view, comms.story.interact@OWN, comms.news.interact@OWN, academics.reference.view, system.session.own@OWN`

**STAFF (у всех сотрудников, кроме STUDENT, PARENT, SUPER_ADMIN, ADMIN, DIRECTOR, где эти права есть в другом виде; 6 прав):**
`hr.leave.view@OWN, hr.leave.manage@OWN, hr.attendance.view@OWN, hr.selfservice.view@OWN, comms.event.staff, academics.calendar.view`
(у CLEANER и GARDENER права = BASE + STAFF и ничего больше)

## 4. Права ролей сверх BASE/STAFF

Обозначения: без суффикса — scope SCHOOL/GLOBAL; `@CLASS`, `@SUBJECT`, `@OWN` — ограниченная область.

- **SUPER_ADMIN** — все 226, кроме `students.gamification.purchase`, `grades.exam.take`, `grades.homework.submit` (это действия ученика). Только у SUPER_ADMIN: `system.cron.manage`, `system.migration.run`, `system.school.provision`, `users.account.delete`, `users.account.security`, `students.profile.purge`, `students.parent.purge`, `academics.class.purge`, `hr.payroll.delete`.
- **ADMIN** — как SUPER_ADMIN без: cron, migration, school.provision, users.account.delete, users.account.security, все `*.purge`, `hr.payroll.delete`.
- **DIRECTOR** — почти всё управление школой: академия, оценки (в т.ч. approve/lock), посещаемость (в т.ч. backdate/delete), финансы целиком (в т.ч. `finance.payment.reverse`, `finance.record.purge`, `finance.cashbox.sweep/setup`, `finance.expense.approve`), HR (кроме payroll.delete, employee.import), договоры (в т.ч. `contracts.year.close`, шаблоны, массовая отмена), приём, сервисы, коммуникации, отчёты, `system.audit.view`, `system.settings.manage`. Нет: интеграций, сессий других пользователей, создания/удаления аккаунтов (`users.account.create/delete`), `users.role.assign`.
- **VICE_DIRECTOR** — академия (класс/программа/группа/расписание/зачисление manage), оценки (entry/term calc/approve/lock, табели, акад. долги), promotion manage+approve, посещаемость (manage, permits approve), дисциплина manage, `hr.employee.view`, договоры (view/manage/approve/delete/export/cancel, amendments), приём (application view/manage, exam, pipeline), объявления/события manage, отчёты (academic, attendance, transcript, performance, export). Нет финансов (кроме договоров).
- **DEPUTY_ACADEMIC** — академия manage, оценки полностью, promotion/graduation (в т.ч. graduation.approve и bulk), отчёты, объявления, admissions.exam/pipeline. Посещаемость только view.
- **DEPUTY_DISCIPLINE** — посещаемость (manage/delete/backdate/notify), разрешения на отсутствие (manage/approve), дисциплина полностью (кроме broadcast), геймификация (manage/award), модерация жалоб, объявления, SMS.
- **DEPUTY_GENERAL** — сотрудники (view), транспорт (view/manage/notify), столовая (полностью), библиотека view, расходы view, объявления/события.
- **DEPUTY_INNOVATION** — просмотр академии и оценок, отчёты academic/performance/export, объявления/события.
- **HEAD_TEACHER** — оценки (manage, approve, lock, табели), расписание и программа manage, зачисление, promotion manage, посещаемость manage, admissions.exam/pipeline.
- **METHODOLOGIST** — программа manage, зачисление, promotion manage, оценки (term approve/calculate, debt), отчёты academic/performance.
- **TEACHER** — в своих классах (`@CLASS`): журнал, ученики, родители, оценки (entry manage, term calculate/approve, табели), посещаемость (manage, notify), дисциплина manage/notify, монеты (award/bulk), проверка семейных миссий, сторис, уведомления классу; в своих предметах (`@SUBJECT`): экзамены, домашние задания, академические долги; `hr.teacher.view`, admissions.exam/pipeline.
- **ASSISTANT_TEACHER** — `@CLASS`: просмотр класса/журнала/учеников/оценок, **отметка посещаемости**; ДЗ view `@SUBJECT`.
- **LAB_ASSISTANT** — программа и расписание view, экзамены view `@SUBJECT`.
- **STUDENT** (`@OWN`): расписание, класс, оценки/итоговые/табель, экзамены (view+take), ДЗ (view+submit), посещаемость, монеты (view+purchase), квитанции, билеты, транспорт; библиотека и столовая view.
- **PARENT** (`@OWN`, только свои дети): профиль ребёнка, расписание, оценки, табели, экзамены, ДЗ, посещаемость, дисциплина, разрешения (view + **request**), монеты, семейные миссии (view+complete), счета/платежи/квитанции, договоры (view + **подпись**), доп. соглашения, заявки на приём (view/manage), билеты, транспорт, транскрипт.
- **ACCOUNTANT** — финансы почти полностью (invoice/payment/reverse/debtor/tariff/expense manage, automation, budget, cashbox, bank, reconcile, export, payment.bulk), payroll view/manage/approve, договоры (view/manage/approve/delete/export/cancel/amendments), ученики view/export/archive, permits approve, SMS. Нет: `finance.expense.approve`, `cashbox.sweep/setup`, `finance.record.purge`, `automation.bulk`.
- **CHIEF_ACCOUNTANT** — как ACCOUNTANT + `finance.expense.approve`, `cashbox.setup`, `cashbox.sweep`, `hr.salary.view/edit`, `hr.employee.view`, `contracts.enforcement.manage`, `admissions.payment.manage`.
- **CASHIER** — payment view/manage (без reverse), квитанции, касса (view/manage), счета/должники/тарифы view, ученики/родители/классы view, договоры view, билеты manage, расходы view, `reports.finance.view`.
- **ECONOMIST** — финансы только view + `finance.budget.manage`, export, payroll/salary view.
- **REGISTRAR** — ученики/родители manage, классы/группы/расписание/программа manage, зачисление, promotion manage, оценки term approve/calculate, табели manage, создание аккаунтов (`users.account.create/edit`, `students.account.create`), опекуны, договоры (manage/approve/delete/export/cancel, кампании), приём полностью (включая депозиты), SMS.
- **SECRETARY** — ученики/родители manage, users view, приём (lead/application/pipeline/intake/waitlist/payment, report), договоры view, объявления/события, SMS.
- **HR_MANAGER** — HR полностью (employee/teacher manage, delete, leave approve, attendance manage, salary view/edit, employment, payroll view/manage), аккаунты (view/create/edit/manage/export), объявления/события.
- **HR_OFFICER** — сотрудники manage, отпуска (manage/approve), табель сотрудников manage, users view.
- **IT_SPECIALIST** — настройки, обслуживание, интеграции, аудит (включая security), сессии всех пользователей, аккаунты (view/manage/export), SMS view.
- **LIBRARIAN** — библиотека полностью, ученики/классы view, уведомления.
- **HEAD_OF_FACILITIES** — транспорт view/manage, столовая полностью, расходы view/manage, события manage.
- **MEDICAL_OFFICER** — ученики/классы view, посещаемость view, разрешения на отсутствие view/manage, столовая view.
- **NURSE** — то же без управления разрешениями.
- **PSYCHOLOGIST** — ученики/родители view, оценки view, посещаемость view, дисциплина view/manage.
- **SOCIAL_WORKER** — ученики/родители view, посещаемость/дисциплина view, разрешения manage, **должники view**.
- **SECURITY** — ученики/классы view, проверка транспортных билетов.
- **WATCHMAN** — проверка билетов.
- **COOK** — столовая view/manage/report. **CAFETERIA_STAFF** — столовая view/report.
- **DRIVER** — рейсы (trip view), запуск/завершение/задержка рейса, посадка учеников (QR/вручную), проверка билетов.

## 5. Доступ к страницам фронтенда (allowedRoles)

Группы: `ADM = SUPER_ADMIN, ADMIN, DIRECTOR`; `ADM+T = ADM + TEACHER`; `ADM+R = ADM + REGISTRAR`.

| Маршрут | Роли |
|---|---|
| /dashboard | ADM, LIBRARIAN, REGISTRAR |
| /users, /users/new, /users/:id, /users/:id/edit | ADM |
| /employees, /employees/new, /:id, /:id/edit, /:id/documents | ADM, HR_MANAGER, HR_OFFICER |
| /employees/payroll | ADM, ACCOUNTANT, HR_MANAGER |
| /employees/leaves, /employees/attendance | ADM, HR_MANAGER, HR_OFFICER |
| /employees/reports, /employees/bulk | ADM, HR_MANAGER |
| /hr/departments, positions, staffing, reports, contracts, timesheets, leave-balances, certifications, vacancies | ADM, HR_MANAGER, HR_OFFICER |
| /hr/dashboard | ADM, HR_MANAGER, HR_OFFICER |
| /my/employment, /my/leaves, /my/attendance, /my/payslip | сотрудники (список `ia` в бандле — не извлечён полностью) |
| /my-finance | ADM, TEACHER, ACCOUNTANT, CASHIER, REGISTRAR, LIBRARIAN |
| /teachers, /teachers/:id, /:id/edit | ADM |
| /students, /students/:id | ADM+T, ACCOUNTANT, CASHIER, REGISTRAR |
| /students/:id/edit | ADM, REGISTRAR |
| /parents, /parents/:id | ADM+T, REGISTRAR |
| /parents/:id/edit | ADM, REGISTRAR |
| /classes, /classes/:id | ADM+T, REGISTRAR |
| /groups, /subjects, /subjects/:id, /discipline, /gamification, /teacher/journal | ADM+T |
| /schedule, /attendance, /grades | ADM+T |
| /homework, /exams | ADM+T, STUDENT |
| /exams/:examId/questions | ADM+T |
| /exams/:examId/take | STUDENT |
| /exams/:examId/results, /result/:attemptId | ADM+T, STUDENT |
| /academics, /academic-years | ADM |
| /academic/dashboard, /academic/grades | ADM, TEACHER, REGISTRAR, VICE_DIRECTOR, DEPUTY_ACADEMIC, HEAD_TEACHER, METHODOLOGIST |
| /academic/transfers, /academic/promotions | ADM, REGISTRAR |
| /finance | ADM, ACCOUNTANT, CASHIER |
| /fee-types | ADM, ACCOUNTANT, CASHIER, REGISTRAR |
| /discount-approvals | ADM |
| /moderation | ADM, DEPUTY_DISCIPLINE |
| /contracts, /contracts/:id | ADM, REGISTRAR, ACCOUNTANT, CASHIER |
| /contracts/new | ADM, REGISTRAR, ACCOUNTANT |
| /contracts/campaigns/new | ADM, REGISTRAR |
| /contracts/templates, /contracts/year-close | ADM |
| /contracts/enforcement | ADM, CHIEF_ACCOUNTANT, ACCOUNTANT |
| /contracts/reports | ADM, REGISTRAR, ACCOUNTANT |
| /reports | ADM, ACCOUNTANT |
| /reports/catalog | ADM, VICE_DIRECTOR, ACCOUNTANT, CHIEF_ACCOUNTANT, CASHIER, REGISTRAR, TEACHER |
| /management | ADM, VICE_DIRECTOR, DEPUTY_GENERAL, DEPUTY_INNOVATION |
| /activity-log | ADM, ACCOUNTANT, CASHIER |
| /school, /school-settings | ADM |
| /admissions/* (leads, kanban, applications, waitlist, tasks, slots, reports) | ADM, REGISTRAR |
| /admissions/exams | ADM, REGISTRAR, TEACHER |
| /admissions/intakes, /admissions/lead-scoring | ADM |
| /transport | ADM |
| /library | ADM, LIBRARIAN |
| /cafeteria | ADM, COOK, CAFETERIA_STAFF, HEAD_OF_FACILITIES |
| /missions/catalog | ADM |
| /missions/review | ADM+T |
| /student/* (dashboard, grades, homework, attendance, schedule, coins) | STUDENT |
| /parent/* (dashboard, payments, profile, contracts, admission, news, children/:id) | PARENT |
| /teacher/* (dashboard, schedule, students, today) | TEACHER |
| /accountant/dashboard | ACCOUNTANT, CASHIER |
| /deputy/dashboard | ADM, VICE_DIRECTOR, DEPUTY_ACADEMIC, HEAD_TEACHER, METHODOLOGIST |
| /registrar/dashboard | ADM, REGISTRAR, SECRETARY |
| /driver/today | DRIVER, ADM |
| /news | ADM, VICE_DIRECTOR, DEPUTY_ACADEMIC, HEAD_TEACHER, METHODOLOGIST |
| /system-health | ADM, IT_SPECIALIST |
| /roles-permissions | SUPER_ADMIN |
| /me, /profile, /messages, /notifications, /events, /settings, /stories | любая авторизованная роль |

**Расхождение UI и сервера (наблюдение):** у многих ролей есть серверные права, но нет страницы во фронтенде. Например, у VICE_DIRECTOR есть `academics.class.manage`, но маршрут `/classes` ему не открыт; у HR_MANAGER есть `users.account.create`, но `/users` открыт только ADM. В новой системе доступ к страницам нужно выводить из прав, а не держать отдельный список.

Публичные (без входа) маршруты: `/login`, `/register`, `/forgot-password`, `/verify/:paymentId`, `/contracts/verify/:number`, `/account-deletion`, `/privacy`, `/terms`, `/support`, `/apply`, `/apply/track`, `/exam/:token`, `/receipt/:id`, `/r/:id`, `/school-setup`.

## 6. Бизнес-правила, заложенные в описаниях прав (Подтверждено как заявленная логика сервера, поведение не тестировалось)

| ID | Правило |
|---|---|
| BR-RB-01 | Удаление одного ученика **каскадно удаляет** его счета, платежи и финансовый профиль (`students.profile.delete`). |
| BR-RB-02 | Массовое удаление учеников, родителей и классов — только SUPER_ADMIN. |
| BR-RB-03 | Посещаемость можно исправлять задним числом в пределах **7 дней**. За пределами окна нужно отдельное право `attendance.record.backdate`. |
| BR-RB-04 | Запрос родителя на разрешение отсутствия создаётся в статусе PENDING и **не влияет на удержания/скидки**, пока его не одобрят. |
| BR-RB-05 | Утверждённая итоговая (четвертная/годовая) оценка **не меняется автоматическим перерасчётом**. |
| BR-RB-06 | Итоговые оценки можно блокировать и разблокировать (reopen). |
| BR-RB-07 | Отмена/удаление платежа (`finance.payment.reverse`) **не выдаётся кассиру**. |
| BR-RB-08 | Расходы выше порогового значения требуют утверждения (`finance.expense.approve`; порог — `GET /expenses/approval-threshold`). |
| BR-RB-09 | Инкассацию кассы (sweep) кассир делать **не может**; создавать новую кассу кассир тоже не может. |
| BR-RB-10 | Сверку банк–касса (reconcile) кассир не делает: это контрольная функция. |
| BR-RB-11 | Договор можно удалить **только если он не подписан**. |
| BR-RB-12 | Отмена договора запускает возврат денег и пересчёт долга. |
| BR-RB-13 | Закрытие учебного года переводит договоры в ARCHIVED/SUPERSEDED **необратимо**. |
| BR-RB-14 | Подпись договора: веб — через OTP; мобильное приложение — без OTP (селфи + рисованная подпись); есть подписание на месте и отказ. |
| BR-RB-15 | Монеты за семейную миссию начисляются **в момент одобрения** проверяющим. |
| BR-RB-16 | Покупка награды за монеты: `studentId` берётся **только из токена** (ученик тратит только свои монеты). |
| BR-RB-17 | Массовое начисление монет — отдельное право; право на единичное начисление не даёт массового. |
| BR-RB-18 | Выпуск (graduation approve) отделён от перевода (promotion approve); у VICE_DIRECTOR права на выпуск нет. |
| BR-RB-19 | Сторис живут **24 часа**; родитель/ученик видит только сторис «для всех» и для своего класса. |
| BR-RB-20 | Ученик и родитель в чате видят только разрешённые контакты. |
| BR-RB-21 | Отметка посадки ученика в автобус — отдельное право водителя; удаление отметки — только `services.transport.manage`. |
| BR-RB-22 | Тариф транспорта (деньги) отделён от управления парком. |
| BR-RB-23 | Удаление начисленной зарплаты стирает аудит, поэтому доступно только SUPER_ADMIN. |
| BR-RB-24 | Учителя (`Teacher`) и сотрудники (`Employee`) — **разные таблицы**; есть `POST /employees/create-from-user/:id`. |

## 7. Что не проверено
- Фактическое поведение каждой роли: тестовых аккаунтов других ролей нет, войти под ними я не могу (вход по паролю выполняет только владелец).
- Список ролей `ia` для страниц `/my/*` (в бандле не извлечён).
- Можно ли менять матрицу из UI: страница `/roles-permissions` есть, но эндпоинтов изменения матрицы в бандле **не найдено** (матрица, вероятно, задана в коде сервера). Гипотеза.
