# Документ C. Спецификации модулей: формы, поля, действия

Источник полей — открытие модальных форм создания в интерфейсе под SUPER_ADMIN с отменой без сохранения (2026-10-23). Типы ответов и данных — из API. `*` = обязательное в UI. «Сервер» = проверено запросом к API (см. E03). Значения по умолчанию указаны так, как их подставляет форма.

Общие UI-паттерны (подтверждено на всех реестрах):
- Реестр: заголовок-«герой» с KPI, кнопки Yangilash (обновить) / Eksport / Import, поиск, фильтры-селекты, переключатель **Kartalar / Ro'yxat** (карточки или таблица), размер страницы (20/50/100), **Ko'rinishlar** (сохранённые представления), пагинация, действия по строке (Ko'rish / Tahrirlash / O'chirish / «Qo'shimcha amallar»).
- Пустые состояния с иконкой, текстом и кнопкой первого действия («Hali … yo'q»).
- Состояния ошибки: «страницу не удалось открыть», «вышла новая версия — обновите страницу» (ChunkLoadError), офлайн-баннер «сервер не отвечает, проверка каждые 10 с».
- Даты в формате **ДД.ММ.ГГГГ** (placeholder `KK.OO.YYYY`) с календарём (кнопки «Bugun», «Kecha», «Tozalash»); время `SS:DD`.
- Удаление и опасные действия — через диалог подтверждения; для части действий нужна причина (≥ N символов), которая пишется в аудит.
- Тёмная и светлая тема, адаптив (мобильное меню), горячая клавиша Ctrl+B.

---

## C-01. Ученик (MOD-002)

### Форма «Yangi o'quvchi» («Faqat profil» — без учётной записи), мастер из 4 шагов
| Шаг | Поле | Тип | Обяз. | По умолч. | Валидация / примечание |
|---|---|---|---|---|---|
| 1 Shaxsiy | Familiya | text | * | — | ≥ 2 симв. |
| 1 | Ism | text | * | — | ≥ 2 симв. |
| 1 | Otasining ismi (отчество) | text | | — | |
| 1 | Telefon | tel | | — | +998 XX XXX XX XX |
| 1 | Email | email | | — | формат e-mail |
| 2 Demografik | Tug'ilgan sana | date | * | — | Будущая дата **не отклоняется** (дефект) |
| 2 | Jins: O'g'il / Qiz | radio | * | — | MALE / FEMALE |
| 2 | Manzil | textarea | | — | |
| 3 Ta'lim | Sinf | select | * | — | Опции «1-A (23/30)» = занято/вместимость; «Sinf tanlanishi shart»; сервер проверяет вместимость |
| 3 | Qabul sanasi (дата зачисления) | date | * | сегодня | |
| 4 Tibbiy | (медицинские поля) | | | | По API: bloodType, allergies, medicalNotes, hasDisability, **emergencyContact***, **emergencyPhone*** (сервер требует оба) |

Дополнительные атрибуты карточки (API, в форме создания не видны): `studentId` (авто GL-xxxxxx), pinfl, nationality, citizenship, birthRegion, birthDistrict, documentType (BIRTH_CERTIFICATE / ID_CARD / PASSPORT / FOREIGN_DOCUMENT), documentSeries, documentNumber, previousSchool, avatar, status, totalCoins, currentCoins, moralScore (100), level (1), experiencePoints, archivedAt, archiveReason, archiveNotes, transferredTo, graduationDate, withdrawalDate, finalSettlement, settlementDate, settlementNotes, lastActiveDate, deletedAt (мягкое удаление).

### Форма «Yangi foydalanuvchi» (ученик с учётной записью)
Первый шаг — выбор роли (radiogroup), затем мастер. Создание учётной записи отправляет SMS с данными для входа (в SMS-логе видны тексты «Hurmatli …! Siz O'quvchi/Ota-ona …»). Отдельно: `POST /students/:id/create-account` — открыть учётку существующему ученику.

### Карточка ученика (GET /students/:id) — агрегирует блоки
профиль, класс (с классным руководителем и учебным годом), user (isActive, isVerified, lastLogin), parents[] (relationship, isPrimary), счётчики, **financial** {totalPaid, totalPending, recentPayments}, **attendance** {stats: total/present/absent/late/excused/sick/percentage, recent}, **academics** {gpa, recentGrades, gradeCount}, **transport** {isAssigned, pickupPoint, pickupTime, vehicle}, **gamification** {coins, level, XP, achievements, recentTransactions}.
Связанные вкладки (API): enrollments, status-history, финансовая сводка и леджер, скидки, тарифы, монеты, нравственный балл и история, транспорт, посадки, билеты, библиотека, транскрипт, табели.

### Операции
| Операция | API | Правила |
|---|---|---|
| Создать | POST /students | Обязательны ФИО, класс, экстренный контакт и телефон; вместимость класса; studentId авто |
| Массово создать / импорт Excel | POST /students/bulk, /students/import | Обязательные колонки, дубли в файле, существующий e-mail → пропуск |
| Редактировать | PUT /students/:id | ADM, REGISTRAR |
| Сменить статус | PUT /students/:id/status, PUT /students/bulk/status, POST /academic/students/:id/status | ACTIVE / INACTIVE / GRADUATED / TRANSFERRED / EXPELLED |
| Перевести в другой класс | PUT /students/:id/transfer, /bulk/transfer, POST /academic/enrollments/transfer | Создаёт событие CLASS_CHANGED (по enum) |
| Архивировать / восстановить / закрыть расчёты | POST /student-archive/:id/archive, /restore, /settle; GET /settlement-preview | Предпросмотр: пропорция платы за текущий месяц, неоплаченные счета, удержания, итоговое сальдо |
| Массовый выпуск | POST /student-archive/bulk-graduate | |
| Удалить | DELETE /students/:id; массово /students/bulk/delete (только SUPER_ADMIN) | Каскад: счета, платежи, финансовый профиль |
| Экспорт | GET /students/export, /export/xlsx, /export/financial-xlsx | |
| Дни рождения | GET /students/birthdays | Дашборд: сегодня + 7 дней, возраст |

---

## C-02. Родитель (MOD-003)
| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| Familiya, Ism | text | * | |
| Otasining ismi | text | | |
| Telefon | tel | * | Уникальность телефона пользователя; при импорте — номер-заглушка +99800… |
| Email | email | | |
| Manzil, Ish joyi (место работы), Kasbi (профессия) | text | | |
API-атрибуты: phoneVerified, profileCompleted, phoneChangedAt, userId. Связь «родитель–ученик»: relationship (FATHER, MOTHER, GUARDIAN, GRANDFATHER, GRANDMOTHER, UNCLE, AUNT, OTHER), isPrimary. Операции: link-student, unlink-student, массовое удаление (только SUPER_ADMIN). **Право подписи договора** — отдельная сущность GuardianAuthority (основание: свидетельство о рождении, опекунство, доверенность, решение суда; статус ACTIVE / EXPIRED / CANCELLED; массовая выдача).
Статистика списка: total, withUser, withoutUser, withMultipleChildren.

## C-03. Учитель (MOD-004) — мастер
Шаг 1: Familiya*, Ism*, Otasining ismi, Tug'ilgan sana*, Jins (MALE / FEMALE). Следующие шаги (по API): phone*, email*, hireDate*, qualification, experience, specialization*, salary, bankAccount, passportNumber, inn, inps, address, avatar, status. Предметы учителя: TeacherSubject {isPrimary}. Категория: INTERN / SPECIALIST / SENIOR / METHODIST / MASTER. Операции: PUT /teachers/:id/subjects, /status; одна учётная запись на учителя.

## C-04. Сотрудник (MOD-005)
Поля (API и подсказки): employeeId, ФИО, gender, dateOfBirth (возраст ≥ 16), phone, email, address, avatar, **position*** (текст) и positionId, department / departmentId, hireDate, **baseSalary***, **rate** (ставка), employmentType (MAIN / PART_TIME / EXTERNAL / CONTRACT / HOURLY / INTERN), status (ACTIVE / ON_LEAVE / RESIGNED / TERMINATED), bankAccount, passportNumber, inn, **pinfl** (14 цифр, уникальность), inps, terminationDate, terminationReason, teacherId (связь с учителем), userId. Документы сотрудника (CONTRACT, PASSPORT, DIPLOMA, CERTIFICATE, MEDICAL, OTHER) со сроками и списком истекающих. Операции: create-from-user, terminate, bulk salary/status/payroll, salary PUT.

## C-05. Пользователь (MOD-006)
Поля: customId («GL ID»), email, phone, ФИО, role, avatar, isActive, isVerified, lastLogin, failedLoginAttempts, lockedUntil, directorOfSchool. Пароль ≥ 8 (заглавная, строчная, цифра). Операции: создать, массово создать, редактировать, переключить активность, переключить верификацию (только SUPER_ADMIN), разблокировать, сбросить пароль (только SUPER_ADMIN), привязать к ученику или учителю, отправить SMS, массовая SMS, экспорт, удалить (только SUPER_ADMIN), история входов, журнал действий, сессии (просмотр и отзыв).

---

## C-06. Класс (MOD-007)
| Поле | Тип | Обяз. | По умолч. | Валидация |
|---|---|---|---|---|
| Sinf darajasi (gradeLevel) | select 1–11 | * | 1 | Сервер принимает 13 (дефект) |
| Bo'lim (section) | select A, B, V, G, D… | * | A | |
| Sinf nomi (name) | text | * | — (пример «5-A») | Уникальное название (409) |
| Xona raqami (roomNumber) | text | | | |
| Sig'im (capacity) | number 1–100 | * | 30 | Сервер: 0 → 30 (дефект) |
| Sinf rahbari (classTeacherId) | поиск учителя | | | Один учитель или пусто |
| O'quv yili (academicYearId) | select | * | текущий | |
Операции: CRUD, назначить классного руководителя (PUT /classes/:id/teacher), разбить на группы (POST /classes/:id/groups/split со стратегией MANUAL / ALPHABET / LEVEL / GENDER / BALANCED), покрытие разбиения (split-coverage), массовое удаление (только SUPER_ADMIN), экспорт. В названиях встречаются суффиксы «UZB» (класс с узбекским языком обучения, например «6-G UZB»).

## C-07. Группа
Guruh nomi*, Tavsif, Tur (SUBGROUP / ELECTIVE / OLYMPIAD / CLUB / REMEDIAL; по умолчанию «Tanlov fani»), Rahbar o'qituvchi*, O'quv yili (пусто = текущий), Sinf (для кружка или факультатива пусто = межклассовая группа), Sig'im (пусто = без ограничения; **в заполненную группу перевод блокируется**), Taqsimlash qoidasi (правило распределения — «только для учёта, видно в отчётах»). Предметы группы с учителем на предмет и часами (`subjectTeachers`). Операции: добавить или убрать учеников, перенести (move), расписание группы, предметы группы. Журнал групп: GET /groups/journal.

## C-08. Предмет
Kod* (≤ 10 символов, например MATH), Nomi*, Tavsif, Haftalik soat (часов в неделю, 1–20, по умолч. 2), Tanlov fani (факультатив), Faol, уровни классов (мультивыбор 1–11, «Barchasi» / «Tozalash»). Быстрые шаблоны: Matematika, O'zbek tili, … «Boshqa fan». Операция «назначить учителей» (PUT /subjects/:id/teachers). Пример данных: 20 предметов (в том числе «ИИ», «С.О», «Стрельба», «Арабский язык», SAT).

## C-09. Учебный год
O'quv yili nomi* (по умолч. «2026-2027»), Boshlanish sanasi* (01.09), Tugash sanasi* (30.06 в форме; в данных 31.05), Joriy (текущий). Действия: set-current, редактировать, удалить. Четверти (Quarter) — сущность есть (`_count.quarters`), UI создания четвертей не найден в обходе (Неизвестно).

## C-10. Политика оценивания (вкладка «Baholash siyosati»)
Уровень: SCHOOL / GRADE / SUBJECT / CLASS; termMethod (WEIGHTED_AVERAGE …), annualMethod (SIMPLE_AVERAGE …), веса по типам оценок, minGradesRequired, examWeight. Валидация: хотя бы один вес > 0. Эффективная политика: CLASS > SUBJECT > GRADE > SCHOOL > DEFAULT (иерархия — Гипотеза по названию `effective`).

---

## C-11. Расписание (MOD-008)
Запись: dayOfWeek (MONDAY–SATURDAY), lessonNumber, startTime, endTime, room, notes, classId или groupId, subjectId, teacherId, isActive. Представления: по дню (матрица «урок × класс»), по классу, по учителю, статистика, конфликты кабинетов, пересечения (TEACHER / ROOM / CLASS / STUDENT; решение REASSIGN_TEACHER / CHANGE_ROOM / MOVE_SLOT через resolve-preview → resolve). Операции: массовая запись по классу, копирование, импорт из Excel, сетка звонков (lesson-times). В проде — 21 конфликт учителей.

## C-12. Журнал (MOD-009)
Выбор класса и предмета → сетка «ученики × дни уроков» (дни берутся из расписания: lesson-days, без праздников и каникул), режимы день / неделя / месяц, ввод оценки по колонке, массовая оценка для одной колонки, панель статистики, экспорт. Портал учителя: «Bugungi darsim» — за урок сохраняются посещаемость, оценки, тема и ДЗ (`POST /teacher-portal/lesson/save`).

## C-13. Посещаемость (MOD-010)
Запись: date, status (PRESENT / ABSENT / LATE / EXCUSED / SICK), checkInTime, checkOutTime, notes, studentId, classId, groupId, markedById, teacherId. Вкладки: отметить (по классу и дате), сводка за сегодня, неделя, месяц, по урокам (`attendance/lessons/mark` — поурочная посещаемость). Действия: массовая отметка, уведомить родителей класса (`/attendance/class/:id/notify`). Правила — см. BR-ATT.

## C-14. Оценка (MOD-011)
Поля: score*, maxScore, type* (EXAM, QUIZ, HOMEWORK, PROJECT, PARTICIPATION, MIDTERM, FINAL), title*, description, date*, comments, studentId*, subjectId*, classId или groupId*, teacherId, quarterId, status (ACTIVE / VOID). Вычисляемые: percentage, letterGrade. Массовый ввод (`/grades/bulk`), уведомление родителей (`/grades/notify`, `/notify/bulk`), журнал класса по четвертям, статистика.

## C-15. Домашнее задание (MOD-012)
Sarlavha*, Sinf yoki guruh*, Fan*, Tavsif, Yo'riqnoma (инструкция), Topshirish muddati* (дата), Maksimal ball (≥ 1, по умолч. 100), Darhol e'lon qilish (опубликовать сразу). Вложения. Статусы сдачи: PENDING / SUBMITTED / RECORDED (учитель отметил офлайн-сдачу) / GRADED / OVERDUE. Операции: publish / вернуть в черновик, submissions, missing (кто не сдал), bulk-grade, record, submit (ученик), аналитика, просроченные ученики, CSV.

## C-16. Экзамен / тест (MOD-013)
Sarlavha*, Tavsif, Fan*, Sinf*, O'qituvchi*, Sana*, Boshlanish (время, 09:00), Davomiyligi (мин, 60 → «окончание: 10:00»), Maksimal ball (100), O'tish balli (проходной, 60), Ko'rsatma. Тип: Odatiy / Viktorina / Test / Oraliq / Yakuniy / Olimpiada. Вопросы (тип, текст*, правильный ответ*, порядок), публикация (нельзя без вопросов), старт, сдача, автопроверка, ручная проверка попытки, результаты и экспорт, кто не сдавал, уведомления.

## C-17. Итоговые оценки и табели (MOD-014)
Вкладки: четвертная оценка, годовая оценка, табели. Действия: рассчитать (массово), утвердить, заблокировать, переоткрыть, история; табели за четверть или год (массово, PDF, версии). Статусы — E01.

## C-18. Движение учеников (MOD-015)
- «Sinf transferi va status»: выбрать класс → ученика → история (enrollments, status-history) и действия (перевод, смена статуса).
- «Ommaviy ko'chirish» (promotion): пакет → решения по каждому ученику (PROMOTED / RETAINED / CONDITIONAL_PROMOTION / TRANSFERRED_OUT / GRADUATED / ACADEMIC_LEAVE / EXPELLED / SKIPPED) → validate → approve → execute → rollback.

---

## C-19. Монеты (MOD-017)
«Tanga berish»: O'quvchi (поиск, ≥ 2 символов), Miqdor* (1–1000, по умолч. 10), Sabab*; быстрые причины из устава (категория и диапазон монет). Также «Tanga ayirish» (списать), «Guruhga» (массово). Магазин наград (Reward: name, description, cost, icon, category PRIVILEGE…, stock, isActive), покупки (выдать / отменить), достижения (award / revoke), челленджи (прогресс, лидерборд), аналитика, контроль (integrity, дневное использование), устав.

## C-20. Семейная миссия (MOD-018)
Sarlavha* (≤ 200), Tavsif* (≤ 1000), Belgi (emoji*, ≤ 16), Kategoriya* (READING, LEARNING, CREATIVITY, HEALTH, BONDING, CHALLENGE), Chastota* (DAILY / WEEKLY / MONTHLY / ONE_TIME), Tanga* (0–1000, 10), XP* (0–5000, 20), Davomiylik (мин, 1–1440), Murakkablik* (1 «очень легко» …), Dalil turi* (тип доказательства; «не требуется» → **автоутверждение**), Tartib raqami* (0–9999), Faol. Проверка: PENDING / APPROVED / REJECTED (монеты начисляются при APPROVED).

## C-21. Дисциплинарный инцидент (MOD-019)
O'quvchi* (поиск), Hodisa turi* (список из устава с указанием штрафа «−2~5»), Jiddiylik* (MINOR / MODERATE / MAJOR / SEVERE), Tavsif*, Sana* (сегодня), Axloqiy ball (0–100), Tanga jarimasi (≥ 0), Chora (принятая мера), Qo'shimcha izoh. Действия: смена статуса (REPORTED → INVESTIGATING → RESOLVED / APPEALED), уведомить родителя, массовое уведомление, экспорт, аналитика, группа риска, сброс нравственных баллов.

---

## C-22. HR (MOD-020)
- **Отдел:** Bo'lim nomi*, Qisqa kod, Ota bo'lim (иерархия; нельзя выбрать себя или своего потомка), Tartib raqami, Izoh, Faol.
- **Должность:** Lavozim nomi*, Qisqa kod, Kategoriya* (MANAGEMENT / PEDAGOGICAL / …), Bo'lim, Tarif razryadi (единая тарифная сетка 1–22), Bazaviy stavka (оклад за 1 ставку), Tartib raqami, Izoh, Pedagogik lavozim, Faol.
- **Строка штатного расписания:** Bo'lim*, Lavozim*, Reja stavka* (ставки, не люди: два совместителя по 0.5 = 1), Bazaviy oylik (пусто = из должности), Izoh, Faol. Отчёт «план / занято / вакантно».
- **Вакансия:** Sarlavha*, Bo'lim, Lavozim, Bandlik turi, Maosh dan/gacha (пусто = «по договорённости»), Tavsif, Talablar. Кандидаты: этапы APPLIED → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED; hire → создаёт сотрудника (Гипотеза).
- **Трудовой договор:** Xodim*, Shartnoma raqami*, Bandlik turi*, Holat* (DRAFT…), Boshlanish sanasi*, Tugash sanasi (пусто = бессрочный), Sinov muddati oxiri (конец испытательного срока), Maosh (видно только с правом), Izoh; файл; доп. соглашения (amendments); истекающие.
- **Аттестация:** Xodim*, Turi*, Nomi*, Toifa (свободный текст), Bergan tashkilot, Berilgan sana*, Amal muddati (пусто = бессрочно), Natija (PASSED / FAILED / PENDING), Ball, Izoh; файл.
- **Баланс отпуска:** Xodim*, Ta'til turi*, Ajratilgan kun* (по умолч. **24** — по Трудовому кодексу), перенос с прошлого года; корректировка (adjust); годовой график (план: PLANNED → CONFIRMED → USED / CANCELLED).
- **Заявка на отпуск:** Xodim*, Ta'til turi*, Boshlanish*, Tugash*, Sabab; approve / reject / cancel; сотрудник — `leaves/request` (себе).
- **Табель:** генерация за месяц из записей посещаемости; статусы DRAFT → SUBMITTED → APPROVED → LOCKED; матрица T-13; утверждённый или заблокированный месяц не пересчитывается.
- **Зарплата:** «Ish haqi hisoblash» — выбор месяца и года → для всех активных сотрудников; ведомость (DRAFT / PENDING / APPROVED / PAID / CANCELLED), breakdown, pay. Движок: timesheetAffectsPayroll = false, workingDays 27 (?), налоговые ставки не заданы.
- **Посещаемость сотрудников:** матрица «сотрудник × день», статусы PRESENT / ABSENT / LATE / LEAVE / HALF_DAY / SICK / HOLIDAY / REMOTE; воскресенья недоступны.

## C-23. Приём (MOD-022)
- **Лид:** Ota-ona ismi* (≥ 2), Telefon, Email, Bola ismi, Tug'ilgan sana, Istalgan sinf, Manba (WEBSITE, PHONE, REFERRAL, SOCIAL, INSTAGRAM, TELEGRAM, WALK_IN, EVENT, ADVERTISEMENT, COLD, OTHER), Bosqich (по умолч. NEW), Operator (пусто = текущий пользователь), Keyingi aloqa sanasi, Izoh. При вводе проверяются дубли («эта семья уже в школе!»). Действия: assign, stage, convert (в заявку), взаимодействия (CALL / CHAT / EMAIL / NOTE / MEETING / SMS), задачи, скоринг. UTM-кампании в отчётах.
- **Заявка:** Familiya*, Ism*, Otasining ismi, Tug'ilgan sana*, Jins, Sinf, Aloqa telefoni, Oldingi maktab, Manba, Izoh (+ набор — обязателен на сервере). Действия: change-status (по матрице переходов), документы (загрузка, ревью, обход требования), назначение экзамена, интервью (+результат), решение (ACCEPTED / WAITLISTED / REJECTED), предложение (send / respond), депозит (payments, refund), sibling, issue-contract, convert (в ученика).
- **Вступительный экзамен:** Sarlavha*, Rejim (Oflayn / онлайн), Sana*, Davomiyligi* (5–600 мин, 60), Sinf darajasi, O'tish balli, Sig'im, Joy, Qabul davri, Tavsif; вопросы, публикация (нужен ≥ 1 вопрос), назначение, результаты, рассадка (PDF). Публичное прохождение по ссылке `/exam/:token` с черновиком и стартом.
- **Задача:** Vazifa nomi*, Mas'ul xodim, Muddat; complete.
- **Слот встречи:** Turi (INTERVIEW / EXAM / TOUR / CONSULT), Sana*, Vaqt*, Davomiyligi (5–480, 30), Sig'im (1–500, 1 — сколько семей на слот), Manzil, Izoh; бронирование (booked/capacity).
- **Набор (intake):** Nomi*, Quyi sinf / Yuqori sinf, Sig'im, даты открытия и закрытия, Imtihon bosqichi yoqilgan, Faol; toggle.
- **Очередь:** отдельно по паре «набор + класс»; reorder, recompact, promote.
- **Публичная подача:** /apply (OTP по телефону: request → verify → application), /apply/track (код отслеживания + телефон).

## C-24. Финансы (MOD-023)
- **Тариф (fee type):** Tarif nomi*, Tavsif, Summa* (≥ 0 в UI; сервер принимает < 0), Kategoriya (TUITION / TRANSPORT / MEAL / LIBRARY / ACTIVITY / UNIFORM / OTHER), Davriylik (MONTHLY / QUARTERLY / SEMESTER / YEARLY / ONE_TIME), Faol; currency UZS. Назначение ученику (customAmount, discountAmount, discountReason, startDate, endDate, isActive). Удаление с `force=true`.
- **Скидка:** см. E03 T-FIN-20. Назначение (customPercent, customAmount, startDate, endDate, notes, attachments, approvedBy). Утверждение (approve / reject с причиной ≥ 3, bulk-approve, revoke), история назначения, отчёт, экспорт.
- **Счёт:** авто-номер INV-YYMM-NNNNN; поля month, year, periodStart, periodEnd, subtotal, discountTotal, totalAmount, paidAmount, balanceDue, currency, status, dueDate, sentAt, paidAt, notes; строки (description, quantity, unitPrice, subtotal, discountAmount, total, feeTypeId). Операции: на ученика за месяц, массовая генерация за месяц, произвольный счёт (custom: ученик, сумма, срок), редактирование, отправка, отмена, удаление (строки удаляются, платежи отвязываются), массовое удаление, PDF, экспорт XLSX, обновление просрочек.
- **Платёж:** paymentId PAY-<timestamp>, receiptNumber RCP-XXXXXXXX, type, amount, currency, status, method, month, year, dueDate, paidDate, paidAmount, transactionId, notes, metadata, invoiceId, processedById. Операции: оплата счёта, быстрая оплата, массовая оплата по классу, partial, process, cancel (не для PAID), удаление, квитанция (публичная проверка по QR `/receipt/:id`, `/verify/:paymentId`), история.
- **Касса:** открыть смену (пересчитать сейф; при расхождении обязательна причина), транзакции, закрыть смену, закрытия, отчёт кассира, инкассация (sweep), создание кассы.
- **Банк:** счета, загрузка выписки CSV (дата и сумма обязательны, минус = расход), сверка (сессия → match / unmatch → complete).
- **Расход:** CRUD, approve / reject / pay / cancel, порог утверждения 1 000 000, статистика.
- **Бюджет:** план по статьям за месяц (полная замена), исполнение «план / факт».
- **Автоматизация:** настройки (E01 §4), preview → generate / generate-full, update-overdue, логи, статистика.
- **Должники / кредиторы:** списки, напоминания (SMS), массовое удаление долгов (отменяет неоплаченные платежи).
- **Сверка счетов учеников:** reconcile (по ученику / всех), sync account, fix.
- **Разрешения на отсутствие (Ruxsatnomalar):** причина (MEDICAL / FAMILY / OFFICIAL / OTHER), период, решение (APPROVED / PARTIALLY_APPROVED / REJECTED), **удержание** = дневная ставка × дни; дневная ставка = месячная плата / 22 рабочих дня (calcMethod WORKING_DAYS); применение удержаний (`deductions/apply`), сводка по классам и ученикам; настройка удержаний.

## C-25. Договоры (MOD-024)
Мастер «Yangi shartnoma»: выбор ученика → параметры (план оплаты MONTHLY_9 / ANNUAL_PREPAY / TWO_YEAR_PREPAY, источник тарифа, скидки) → предпросмотр расчёта (finance-preview: годовая сумма, график из 9 платежей, предоплата −10 %, «2 года — 3-й бесплатно», `grantsFreeYear`) → validate → approve → generate (PDF из DOCX-шаблона с токенами) → доставка и подпись родителя (OTP / ERI / CLICK_ACCEPT / IN_PERSON с фото лица) → подпись школы → SIGNED. Доп. соглашения: создать → approve → generate → sign → apply. Кампании: validate (READY / DATA_MISSING / DUPLICATE / NO_GUARDIAN / PHONE_UNVERIFIED / NO_TARIFF) → preview → generate → send → retry-failed → progress. Публичная проверка: `/contracts/verify/:number`. Шаблон: Kod*, Nomi* (≤ 200), Tavsif (≤ 500); версии DOCX, публикация.

## C-26. Транспорт (MOD-026)
ТС: Davlat raqami*, Model*, Sig'imi (1–100, 30), Yo'nalish nomi, Yo'nalish tafsilotlari, Haydovchi ismi*, Haydovchi telefoni*. Документы ТС. Маршрут → остановки (название уникально в маршруте, широта и долгота, порядок, время) → прикрепление учеников (нужна ≥ 1 остановка, вместимость). Рейсы: generate, start / complete / delay / cancel, манифест, посадка (QR-скан / вручную / массово), уведомления родителям. Тариф: общий по умолчанию и по маршруту → resync обязательств учеников (без тарифа строка счёта не создаётся). Билеты (оплата, PDF, проверка по QR, отмена).

## C-27. Библиотека (MOD-027)
Книга: Kitob nomi*, Muallif*, Nashriyot, ISBN, Nashr yili, Kategoriya* (по умолч. «Darsliklar»), Til (O'zbek …), Nusxalar soni (≥ 1), Joylashuv (полка), обложка (≤ 5 МБ). Выдача: сканирование штрихкода или ISBN или поиск → ученик → срок. Продление, возврат, утеря, списание, штраф за просрочку, квитанция (PDF), напоминания. Правила — E01 §7.

## C-28. Столовая (MOD-028)
Приёмы пищи (BREAKFAST 07:30–08:30, LUNCH 12:00–13:00, SNACK 15:00–15:30, DINNER 18:00–19:00; цвет, иконка, порядок), категории, блюда (без состава и аллергенов — в БД нет таких полей), меню на день (≥ 1 приём пищи) → позиции → публикация; копирование недели, публикация недели; кухонный лист, отчёт о расходе, экспорт.

## C-29. Коммуникации
- **Уведомление «Xabar yuborish»:** Kimga (вся школа / класс / роль / пользователи; предпросмотр аудитории — «отправить 1243 людям»), Turi, Muhimlik (LOW / NORMAL / HIGH / URGENT), Sarlavha* (≤ 200), Xabar matni*; каналы (in-app, push, SMS); отправка по шаблону; статистика доставки; тихие часы; предпочтения пользователя.
- **Объявление:** DRAFT / SCHEDULED / PUBLISHED / ARCHIVED, закрепление, дублирование, вложения, статистика прочтения; ограничение по роли или классу отключает публичность.
- **Новость:** Sarlavha*, Qisqa matn, Matn*, Teg, Fon rangi, Muqova (URL или файл), медиа (до 24 шт.: фото, видео, ссылки), Nashr etish, Qadash, «показывать на публичной странице»; комментарии (вкл/выкл, скрытие), реакции.
- **Событие:** Sarlavha*, Tavsif, Turi*, Boshlanish sanasi*, Tugash sanasi (многодневное), Kun bo'yi (весь день), время начала и окончания (нужно для расчёта пересечения с уроками), Joy, аудитория (вся школа / только сотрудники), Bildirishnoma yuborilsin. Проверка конфликтов.
- **Чат:** личные и групповые беседы, scope-каналы (классы), вложения, голосовые, пересылка, закрепление, редактирование, удаление, mute, read, жалоба, поиск, экспорт беседы, аналитика; события socket.io: `new_message`, `message:deleted`, `messages:read`, `notification:new`, `data:changed` (инвалидация кешей по доменам).
- **Сторис:** фото или видео, 24 часа, просмотр, лайк, комментарий, модерация.

## C-30. Школа и система
- **/school:** название, короткое название, код, логотип, адрес, регион, телефон, e-mail, сайт, учебные настройки, финансовые реквизиты (STIR/ИНН, MFO, банк, счёт), лицензия, описание, директор (назначение), подпись директора и печать (файлы для договоров).
- **/activity-log:** userId, action, entity, entityId, oldData, newData, ipAddress, userAgent, createdAt; фильтры по сущности и действию (со счётчиками).
- **/system-health:** память, версия, объём таблиц, экспорт данных, резервная копия (`/settings/backup`), хранилище (`/settings/storage`).
- **/me:** профиль, финансы (если сотрудник), безопасность (смена пароля, сессии, выход с других устройств), активность, настройки (язык uz, уведомления: email / push / sms по типам, внешний вид).
