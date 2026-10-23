# Документ B. Полный каталог модулей, страниц и функций

Платформа: **Genius Land — «Maktab Boshqaruv Tizimi»** (система управления школой). Интерфейс на узбекском (латиница), часть контента (предметы, имена учителей) — на русском.
Метод инвентаризации (2026-10-23): (1) меню и маршруты из публичного JS-бандла; (2) обход 92 страниц в интерфейсе под SUPER_ADMIN со снятием заголовков, вкладок, кнопок, колонок таблиц и полей ввода; (3) каталог API (GET-запросы — только чтение).
Статусы проверки: **О** — страница открыта и описана; **Д** — открыта, но данных нет (пустое состояние); **Р** — проверена по ролям (не выполнялось); **API** — подтверждено только по API/коду.

## 1. Структура меню (SUPER_ADMIN/ADMIN/DIRECTOR)

| Группа меню | Пункты (маршрут) |
|---|---|
| — | Bosh sahifa (/dashboard) |
| Dars va baholash (уроки и оценки) | Dars jadvali (/schedule), Jurnal (/teacher/journal), Davomat (/attendance), Baholar (/grades), Uy vazifalari (/homework), Imtihonlar (/exams) |
| Rag'batlantirish va intizom | Tanga tizimi (/gamification), Oilaviy missiyalar (/missions/catalog), Missiya tasdiqlash (/missions/review), Intizom (/discipline) |
| O'quv tuzilmasi | Akademik (/academics), Sinflar (/classes), Guruhlar (/groups), Fanlar (/subjects) |
| Akademik boshqaruv | O'rinbosar paneli (/deputy/dashboard), Akademik dashboard (/academic/dashboard), Baho yakunlash (/academic/grades), Sinf transferi (/academic/transfers), Ommaviy ko'chirish (/academic/promotions) |
| Odamlar | O'quvchilar (/students), Ota-onalar (/parents), O'qituvchilar (/teachers), Xodimlar (/employees), Foydalanuvchilar (/users) |
| Kadrlar bo'limi (HR) | Kadrlar paneli (/hr/dashboard), Bo'limlar, Lavozimlar, Shtat jadvali (/hr/staffing), Vakansiyalar, Shartnomalar (/hr/contracts), Tabel (/hr/timesheets), Ta'til balansi, Attestatsiya, Hisobotlar (/hr/reports) |
| Qabul (приём) | Ro'yxatchi paneli (/registrar/dashboard), Qabul paneli (/admissions), Nomzodlar (/admissions/leads), Voronka (/admissions/kanban), Arizalar (/admissions/applications), Imtihonlar (/admissions/exams), Navbat (/admissions/waitlist), Vazifalar (/admissions/tasks), Uchrashuvlar (/admissions/slots), Qabul hisoboti, Qabul davrlari (/admissions/intakes), Ball sozlamalari (/admissions/lead-scoring) |
| Moliya | Moliya (/finance), Tarif turlari (/fee-types), Chegirma tasdiqlash (/discount-approvals), Shikoyatlar (/moderation), Shartnomalar (/contracts), Qarzdorlik ijrosi (/contracts/enforcement), Yilni yakunlash (/contracts/year-close) |
| Xizmatlar | Transport (/transport), Kutubxona (/library), Oshxona (/cafeteria), Reyslarim (/driver/today) |
| Aloqa | Chatlar (/messages, счётчик непрочитанных), Xabarlar (/notifications), Yangiliklar (/news), Maktab lentasi (/stories), Tadbirlar (/events) |
| Hisobot va tahlil | Hisobotlar (/reports), Hisobot katalogi (/reports/catalog), Boshqaruv paneli (/management) |
| Mening ishim (мой HR) | Mehnat kartochkam (/my/employment), Ta'tillarim (/my/leaves), Davomatim (/my/attendance), Hisob-kitob varaqam (/my/payslip) |
| Tizim | Maktab (/school), Amallar tarixi (/activity-log), Rollar va ruxsatlar (/roles-permissions), Tizim salomatligi (/system-health) |
| — | Mening profilim (/me), Sozlamalar (/settings) |

Особые меню: **TEACHER** — «Bugungi darsim» (/teacher/today), Bosh sahifa (/teacher/dashboard), Dars jadvalim, O'quvchilarim, Jurnal + общие разделы. **ACCOUNTANT/CASHIER** — /accountant/dashboard, Moliya, Tarif turlari, O'quvchilar, Shartnomalar, Qarzdorlik ijrosi, Ish haqi (/employees/payroll), Transport, Hisobotlar, Amallar tarixi. **STUDENT** — Bosh sahifa, Dars jadvalim, Baholarim, Uy vazifalarim, Darsga kelishim, Uy vazifalari, Imtihonlar, Tangalarim + Aloqa. **PARENT** — Bosh sahifa, Maktab yangiliklari, To'lovlar, Shartnomalar, Mening arizam, Aloqa, Profilim; переключатель «активный ребёнок» (запоминается в localStorage).
Пункты меню фильтруются по `allowedRoles` роли (см. Документ G). Боковое меню сворачивается (Ctrl+B), группы раскрываются и сворачиваются, состояние запоминается.

Верхняя панель: глобальный поиск учеников (по `/students`) и пользователей (по `/users`), от 2 символов, до 8 результатов; переключатель темы (светлая / тёмная / системная); колокольчик уведомлений (10 непрочитанных, обновление раз в 30 с, socket.io-событие `notification:new`, звук и браузерные push-уведомления); меню пользователя (Профиль, Настройки, Выход).

## 2. Реестр модулей

| ID | Модуль | Страницы | Назначение | Данные в проде |
|---|---|---|---|---|
| MOD-001 | Дашборд | /dashboard | Сводка: ученики, учителя, классы, % посещаемости, учебный год, дни рождения (сегодня + 7 дней), расписание на сегодня, посещаемость за вчера, финансы, SMS, виджеты модулей, топ учеников, события, лента активности | есть |
| MOD-002 | Ученики | /students, /students/:id, /:id/edit | Реестр, карточка, импорт, экспорт, архив | 629 активных |
| MOD-003 | Родители | /parents, /parents/:id, /:id/edit | Реестр, привязка к детям | ~537 |
| MOD-004 | Учителя | /teachers, /:id, /:id/edit | Реестр, предметы, статус | 69 |
| MOD-005 | Сотрудники (HR-реестр) | /employees, /new, /:id, /:id/edit, /:id/documents, /employees/bulk | Реестр сотрудников, документы, массовые операции | несколько |
| MOD-006 | Пользователи | /users, /new, /:id, /:id/edit | Учётные записи, роли, блокировки, сессии | 1244 |
| MOD-007 | Учебная структура | /academics, /academic-years, /classes, /classes/:id, /groups, /subjects, /subjects/:id | Учебные годы, классы, группы, предметы, политика оценивания | 1 год, 37 классов, 8 групп, 20 предметов |
| MOD-008 | Расписание | /schedule | Сетка по дням, по классу, по учителю, статистика, конфликты кабинетов, пересечения; импорт из Excel | есть (≈50 уроков в пятницу) |
| MOD-009 | Журнал | /teacher/journal | Журнал класса/предмета: день/неделя/месяц, оценки, статистика | есть |
| MOD-010 | Посещаемость | /attendance | Отметка, сводка за день, неделя, месяц, по урокам | есть |
| MOD-011 | Оценки | /grades | Журнал оценок класса по предмету | мало (1 оценка) |
| MOD-012 | Домашние задания | /homework | Задания, аналитика, просрочки | 2 активных |
| MOD-013 | Экзамены/тесты | /exams, /exams/:id/questions, /take, /results | Онлайн-тесты с вопросами, попытки, автопроверка | 1 |
| MOD-014 | Итоговые оценки и табели | /academic/grades | Четвертные и годовые оценки, табели | пусто (нет четвертей) |
| MOD-015 | Движение учеников | /academic/transfers, /academic/promotions | Перевод между классами, смена статуса, массовый перевод в следующий класс, выпуск | пусто |
| MOD-016 | Панели руководства | /deputy/dashboard, /academic/dashboard, /management | Заполнение журнала, итоговые оценки, группа риска, очередь согласований, финансовые потоки | есть |
| MOD-017 | Геймификация (монеты) | /gamification, /student/coins | Лидеры, транзакции, достижения, магазин, задания, устав, аналитика, контроль | рейтинг есть, транзакций нет |
| MOD-018 | Семейные миссии | /missions/catalog, /missions/review | Каталог миссий для семьи, проверка доказательств, монеты и XP | пусто |
| MOD-019 | Дисциплина | /discipline | Инциденты, устав, нравственные баллы | 9 инцидентов |
| MOD-020 | HR | /hr/* , /employees/payroll, /leaves, /attendance | Отделы, должности, штатное расписание, вакансии, трудовые договоры, табель (T-13), отпуска, аттестация, отчёты, зарплата | пусто |
| MOD-021 | Самообслуживание сотрудника | /my/*, /my-finance | Своя карточка, отпуска, посещаемость, расчётный листок | для SUPER_ADMIN «карточка не открыта» |
| MOD-022 | Приём (CRM приёмной) | /registrar/dashboard, /admissions/* , публичные /apply, /apply/track, /exam/:token | Лиды, воронка, заявки, вступительные экзамены, очередь, задачи, встречи, наборы, скоринг, отчёты | пусто |
| MOD-023 | Финансы | /finance (22 вкладки), /fee-types, /discount-approvals | Счета, платежи, расходы, бюджет, должники, кредиторы, сверка, оплаты класса, разрешения, профиль ученика, календарь, тарифы, скидки, автоматизация, зарплата, касса, отчёт кассира, банк, история | тарифы есть, операций нет |
| MOD-024 | Договоры с родителями | /contracts, /new, /:id, /campaigns/new, /templates, /templates/:id, /reports, /enforcement, /year-close; публичный /contracts/verify/:number | Договоры, шаблоны DOCX, массовые кампании, электронная подпись (OTP/на месте), доп. соглашения, взыскание, закрытие года | пусто |
| MOD-025 | Модерация | /moderation | Жалобы на сообщения и сторис | пусто |
| MOD-026 | Транспорт | /transport, /driver/today | ТС, маршруты, остановки, рейсы, билеты, тарифы, платежи, аналитика, водители, посадка по QR | пусто |
| MOD-027 | Библиотека | /library | Книги, выдачи, просрочки, аналитика, популярное, фонд, правила | пусто |
| MOD-028 | Столовая | /cafeteria | Меню дня и недели, кухонный лист, расход, блюда, категории, настройки приёмов пищи | только приёмы пищи |
| MOD-029 | Чат | /messages | Личные и групповые чаты, вложения, голосовые, закрепление, пересылка, жалоба | есть |
| MOD-030 | Уведомления и объявления | /notifications (7 вкладок), /announcements → редирект | Уведомления, объявления, отправленные, шаблоны, аналитика, настройки, SMS-шаблоны | есть |
| MOD-031 | Новости | /news | Новости с медиа, комментарии, реакции | пусто |
| MOD-032 | Школьная лента (сторис) | /stories | Сторис на 24 часа: фото/видео, лайки, комментарии, просмотры | пусто |
| MOD-033 | События/календарь | /events | Список, месяц, неделя; события для сотрудников; конфликты | пусто |
| MOD-034 | Отчёты | /reports (6 вкладок), /reports/catalog (23 отчёта) | Аналитика и выгрузки (JSON/CSV/Excel/PDF) | есть |
| MOD-035 | Школа и настройки | /school, /school-settings, /settings, /me, /profile | Реквизиты, логотип, подпись директора, печать, учебные настройки, банк, лицензия; личный профиль | есть |
| MOD-036 | Аудит | /activity-log | Журнал действий (CREATE/UPDATE/DELETE/LOGIN…) | 23 страницы |
| MOD-037 | RBAC | /roles-permissions | Матрица «право × роль» (только просмотр) | 226 × 37 |
| MOD-038 | Здоровье системы | /system-health | Память, версия, объём таблиц, экспорт данных | есть |
| MOD-039 | Портал ученика | /student/* | Дашборд, расписание, оценки, ДЗ, посещаемость, монеты, тесты | Р |
| MOD-040 | Портал родителя | /parent/* | Дети, платежи, договоры (подпись), заявка на приём, новости, профиль | Р |
| MOD-041 | Портал учителя | /teacher/* | Урок сегодня (посещаемость + оценки + ДЗ за урок), дашборд, расписание, ученики | Р |
| MOD-042 | Портал бухгалтера | /accountant/dashboard | Финансовая панель | Р |
| MOD-043 | SMS-шлюз | (в /notifications, /dashboard) | Провайдер ESKIZ, баланс, история, тест, шаблоны | есть, 1 ошибка |
| MOD-044 | Онлайн-оплата | /verify/:paymentId, /receipt/:id, /r/:id | Payme, Click, Uzum (выключены), проверка квитанции по QR | выключено |
| MOD-045 | Мобильное приложение | — | Упоминается в UI (подпись договора без OTP, push-устройства ANDROID/IOS, удаление аккаунта) | Неизвестно |
| MOD-046 | Публичные страницы | /login, /register, /forgot-password, /privacy, /terms, /support, /account-deletion, /school-setup | Вход, регистрация, сброс пароля по SMS-коду (10 минут), юридические страницы | О (частично) |

## 3. Страницы: элементы интерфейса (снято обходом)

Обозначения: H — заголовки; TABS — вкладки; BTN — действия; TH — колонки таблиц.

### Люди
- **/students** — H: O'quvchilar / «Sinf darajalari bo'yicha» (распределение по уровням). TABS: Barchasi, 1-sinf…11-sinf (с количеством), вид Kartalar/Ro'yxat. BTN: Yangilash, Eksport, Arxiv, Import, «Yangi foydalanuvchi» (с аккаунтом) / «Faqat profil» (только профиль), размер страницы (20), Ko'rinishlar (сохранённые виды), Ko'rish, «Qo'shimcha amallar» (доп. действия). Поиск. Пагинация (32 стр. × 20).
- **/parents** — Kartalar/Ro'yxat; BTN: Yangi foydalanuvchi / Faqat profil, Ko'rish, Tahrirlash, O'chirish; 27 стр.
- **/teachers** — то же, 100 на странице.
- **/employees** — BTN: Yangi xodim, «Foydalanuvchidan» (из пользователя), Ish haqi, Ta'tillar, Davomat, Hisobotlar, Ommaviy; фильтры по статусу и отделу. TH: Сотрудник | Должность | Отдел | Контакт | Оклад | Статус | Действия.
- **/users** — TABS по ролям с количеством: всего 1244, O'quvchi 631, Ota-ona 537, O'qituvchi 69, Super Admin 4, Administrator 2, Buxgalter 1. BTN: Import, «GL ID» (миграция идентификаторов), Eksport, Yangi qo'shish, фильтры, массовый выбор (чекбоксы).

### Учебный процесс
- **/classes** — Yangi sinf; фильтры по классу и статусу; Export; Ko'rish/Tahrirlash/O'chirish.
- **/groups** — Yangi guruh; фильтры по типу и классу; мастер-детали («Guruhni tanlang»).
- **/subjects** — Yangi fan; фильтры по классу и типу; «O'qituvchi tayinlash» (назначить учителя); распределение по уровням.
- **/academics** — TABS: O'quv yillari, Sinflar, Fanlar, Baholash siyosati (политика оценивания).
- **/schedule** — TABS: Kunlik, Sinf, O'qituvchi, Statistika, Xona konflikti, To'qnashuvlar; дни Пн–Сб. Таблица «SOAT × классы». BTN: Excel import.
- **/teacher/journal** — выбор класса и предмета; навигация по периоду; режимы Kun/Hafta/Oy; «Baho»; «Statistika paneli»; «Kalendardan tanlash».
- **/attendance** — TABS: Davomat olish (отметить), Bugungi xulosa (сводка за день), Haftalik, Oylik, Dars bo'yicha (по урокам); выбор класса и даты.
- **/grades** — журнал оценок: класс + предмет.
- **/homework** — TABS: Vazifalar, Analitika, Kechiktirilgan; фильтры Barchasi/Faol/O'tgan/Topshirilgan/Qoralama; BTN: Yangi vazifa, CSV; по заданию: «сданные», «вернуть в черновик», редактировать, удалить.
- **/exams** — TABS: Barchasi, Rejalashtirilgan, Davom etmoqda, Tugallangan; Yangi imtihon, CSV, фильтр.
- **/academic/grades** — TABS: Choraklik baho, Yillik baho, Tabellar; кнопка Hisoblash (рассчитать).
- **/academic/transfers** — выбор класса, затем ученика (история и действия).
- **/academic/promotions** — «Yangi ko'chirish» (пакет перевода).
- **/academic/dashboard** — TH: Класс | Наполненность | Средний балл | Посещаемость | Группа риска; переключатель «текущий год / весь год».
- **/deputy/dashboard** — быстрые действия, заполненность журнала (приблизительно), статус итоговых оценок, ученики группы риска по классам.

### Поощрения и дисциплина
- **/gamification** — TABS: Liderlar, Tranzaksiyalar, Yutuqlar, Do'kon, Vazifalar, Ustav, Analitika, Nazorat. BTN: Tanga berish (начислить), Tanga ayirish (списать), Guruhga (группе). TH: # | Ученик | Класс | Уровень | Нравственный балл | Монеты | Действия.
- **/missions/catalog** — Yangi missiya; фильтры по периодичности (Daily/Weekly/Monthly/One-time) и категории.
- **/missions/review** — TABS: Kutilmoqda, Tasdiqlangan, Rad etilgan.
- **/discipline** — TABS: Hodisalar, Ustav, Axloqiy ballar; статусы с количеством (REPORTED 9). BTN: Yangi hodisa, Eksport, по записи: Ko'rish, Holatni o'zgartirish, Tahrirlash, O'chirish, «только инциденты этого ученика».

### HR
- **/hr/dashboard** — сотрудники по отделам, очередь заявок на отпуск, кто сегодня отсутствует, истекающие документы.
- **/hr/departments, /positions, /staffing, /vacancies, /contracts, /certifications** — CRUD-реестры (пусты).
- **/hr/timesheets** — TABS: Oy yakuni (итоги месяца), Kunlik matritsa (T-13); Tabel hisoblash; выбор года и месяца.
- **/hr/leave-balances** — TABS: Balans, Yillik grafik; Balans belgilash, Rejaga qo'shish.
- **/hr/reports** — «Kadrlar harakati» (движение кадров): Месяц | Принято | Уволено | На конец месяца | Текучесть %; Excel/CSV/PDF.
- **/employees/payroll** — Ish haqi hisoblash (за месяц и год), фильтр статуса.
- **/employees/leaves** — Yangi ta'til; фильтры по статусу и типу.
- **/employees/attendance** — матрица «сотрудник × день месяца (1–31) + ИТОГО», кнопка отметки по дню; воскресенья не отмечаются (4, 11, 18 — нет кнопки).

### Приём
- **/registrar/dashboard** — воронка лидов, статусы заявок, встречи сегодня, очередь, открытые задачи, реестр учеников.
- **/admissions/leads** — Yangi murojaat; фильтры Bosqich (этап), Ball darajasi (hot/warm/cold), Operator.
- **/admissions/kanban** — канбан по этапам.
- **/admissions/applications** — Yangi ariza; фильтры по статусу и менеджеру.
- **/admissions/tasks** — Bugun, Muddati o'tgan, Mening, Ochiq, Barchasi.
- **/admissions/reports** — TABS: Voronka, Manbalar, Kampaniya (UTM), Operatorlar, Sikl vaqti, Qabul davrlari; TH: Этап | Кол-во | % от начала | % от предыдущего | Потеряно.
- **/admissions/lead-scoring** — веса компонентов, пороги hot/warm, Saqlash, Ball backfill, Standartga qaytarish.

### Финансы
- **/finance** — 22 вкладки: Dashboard, Tahlil, Hisobotlar, Fakturalar, To'lovlar, Xarajatlar, Byudjet, Qarzdorlar, Haqdorlar (кредиторы/переплаты), Hisob solishtirish (сверка), Sinf to'lovlari, Ruxsatnomalar (разрешения на отсутствие — связь с удержаниями), O'quvchi profil, Kalendar, To'lov turlari, Chegirmalar, Avtomatlashtirish, Ish haqi, Kassa, Kassir hisoboti, Bank, Faoliyat tarixi. Периоды: сегодня / неделя / месяц / прошлый месяц / год. Виджеты: финансовые показатели, дневной тренд, способы оплаты, последние платежи, топ-должники, месячный доход. Кнопка «Sinxronlashtirish» (синхронизация счетов учеников).
- **/fee-types** — Yangi tarif; фильтры по категории, периодичности и статусу (есть тариф «Transport xizmati»).
- **/discount-approvals** — очередь скидок на утверждение.
- **/contracts** — Yangi shartnoma, Kampaniya, Shablonlar, Hisobotlar; фильтры по году, классу, типу документа, статусу; «Imzo huquqini ommaviy berish» (массово выдать право подписи).
- **/contracts/new** — мастер: выбор ученика → Keyingi.
- **/contracts/enforcement** — TABS: Barchasi, Ogohlantirilgan, To'xtatilgan, Taklif; Sozlama, «Hozir yurgizish» (запустить сейчас).
- **/contracts/year-close** — выбор учебного года.
- **/contracts/reports** — 20 отчётов (см. E01), период, Excel/PDF.

### Сервисы
- **/transport** — TABS: Yo'nalishlar, Marshrutlar, Reyslar, Chiptalar, Tariflar, To'lovlar, Analitika, Haydovchilar; Transport qo'shish.
- **/library** — TABS: Kitoblar, Olinganlar, Muddati o'tgan, Analitika, Mashhur, Fond; BTN: Kitob berish, Qoidalar, Kitob qo'shish; сортировка по названию.
- **/cafeteria** — TABS: Bugungi menyu, Haftalik, Oshxona varag'i (кухонный лист), Sarf hisoboti (расход), Taomlar, Kategoriyalar, Sozlamalar.
- **/driver/today** — рейсы на дату, закреплённая техника.

### Коммуникации, отчёты, система
- **/messages** — Barchasi, O'qilmagan, Guruhlar; новый чат.
- **/notifications** — TABS: Bildirishnomalar, E'lonlar, Yuborilganlar, Shablonlar, Analitika, Sozlamalar, SMS shablonlar; Xabar yuborish; фильтры по типу, статусу, важности и дате; «удалить прочитанные», CSV-экспорт.
- **/news**, **/stories**, **/events** (Ro'yxat/Oy/Hafta; Barchasi/Kutilmoqda/Bugun/Arxiv/Bekor qilingan; Eksport; календарь сотрудников).
- **/reports** — TABS: Umumiy, Moliyaviy, Davomat, Baholar, O'quvchilar, Guruhlar; Chop etish (печать).
- **/reports/catalog** — 23 отчёта, группы, Ochish.
- **/management** — «центр решений»: очередь утверждений (`/approvals/queue`), классы (посещаемость и оценки), финансовый поток, старение долга, кадры, охват транспортом; период месяц / четверть / год.
- **/school** — контакты, учебные настройки, финансовые данные, банк, юридические данные (лицензия), «о школе»; Logo, Rahbar (директор), Tahrirlash.
- **/activity-log** — фильтры, поиск, пагинация.
- **/roles-permissions** — TH: Код права | Модуль | колонки ролей; поиск (только чтение).
- **/system-health** — память, информация о системе, экспорт данных, объём таблиц (Таблица | Записей | Примерный объём).
- **/me** — TABS: Umumiy, Moliya, Xavfsizlik (сессии, пароль), Faoliyat, Sozlamalar.

## 4. Непроверенные страницы и причины
| Страница | Причина |
|---|---|
| /student/*, /parent/*, /teacher/*, /accountant/dashboard | Видны только под соответствующей ролью; входить под другими аккаунтами по паролю я не могу |
| /exams/:id/take, /exam/:token, /apply, /apply/track | Сценарий ученика или публичный; не проходился (чтобы не создавать реальную заявку и попытку) |
| /users/:id, /students/:id, /classes/:id и другие страницы-карточки | Структура данных снята через API; визуально карточки подробно не описаны |
| /contracts/:id, /contracts/templates/:id, /contracts/campaigns/new, /admissions/leads/:id, /admissions/applications/:id | Нет записей |
| Модальные формы создания | См. Документ C (часть форм снята) |
