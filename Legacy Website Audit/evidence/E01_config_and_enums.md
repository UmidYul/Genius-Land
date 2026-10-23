# Evidence E01 — конфигурация, справочники и enum-ы (снято 2026-10-23)

Источник: GET-запросы к `https://geniusland.uz/api/v1/*` из авторизованной сессии SUPER_ADMIN (только чтение), а также словари подписей из публичного JS-бандла. Персональные данные в этот файл не включены.

## 1. Системное
- `GET /settings/system`: version **2.0.0**, environment production, database **PostgreSQL**, counts: schools 1, students 629, teachers 69, classes 37, users 1244; features: gamification, sms, payments, library, transport, cafeteria = true.
- `GET /setup/status`: initialized, hasSchool, hasUsers = true (есть мастер первичной настройки `/school-setup`, `POST /setup/init`).
- `GET /payment-gateway/gateway/status`: payme=false, click=false, uzum=false (онлайн-оплата **не подключена**).
- `GET /settings/public`: название, адрес, телефон, e-mail, сайт, логотип, описание школы (частная общеобразовательная школа в Маргилане, 1–11 классы; подача заявки на приём без аккаунта, с кодом отслеживания).

## 2. Учебный год и звонки
- Учебный год: `name "2026-2027"`, `startDate 2026-09-01`, `endDate 2027-05-31`, `isCurrent true`, `_count {classes 37, quarters 0}` → **четверти (quarters) ещё не созданы**.
- `GET /schedules/lesson-times`: 8 уроков: 1) 08:00–08:45, 2) 08:55–09:40, 3) 09:50–10:35, 4) 10:55–11:40, 5) 11:50–12:35, 6) 12:45–13:30, 7) 13:40–14:25, 8) 14:35–15:20. Поле `label` = null.
- **Противоречие:** на дашборде урок 1 показан как 08:30–09:15, урок 2 — 08:50–09:35. Время урока хранится в самой записи расписания и не обязано совпадать с сеткой звонков (Частично подтверждено).

## 3. Оценки — политика расчёта (`GET /academic/grade-policies/effective`)
- source: DEFAULT (своих политик нет, `items: []`).
- termMethod: **WEIGHTED_AVERAGE**, annualMethod: **SIMPLE_AVERAGE**.
- typeWeights: EXAM 3, FINAL 3, MIDTERM 2, PROJECT 2, QUIZ 1.5, HOMEWORK 1, PARTICIPATION 0.5.
- minGradesRequired: **3** (если оценок меньше, статус итоговой оценки = NOT_ENOUGH).
- examWeight: 1.
- Политика может задаваться по уровням (scope): SCHOOL / GRADE / SUBJECT / CLASS.

## 4. Финансовая автоматизация (`GET /finance/automation/settings`)
enabled **false**; generationDay 1; dueDay 15; autoSendSms true; smsTemplate «Hurmatli ota-ona! {student_name} uchun {month} oyi to'lovi {amount} so'm. Muddat: {due_date}. {school_name}»; includeTransport/includeMeals/includeOther true; applyDiscounts true; skipIfPaid true; autoMarkOverdue true; overdueDay 0; sendReminders true; reminderDaysBefore 3.

## 5. Взыскание долгов по договорам (`GET /contract-enforcement/settings`)
enabled false; graceDays 0; cancelAfterWarningDays 10; cancelMinLateCycles 2; smsEnabled false.
Статусы дела: WARNED → SUSPENDED → CANCELLATION_PROPOSED → RESOLVED / DISMISSED.

## 6. Скоринг лидов (`GET /admissions/lead-scoring/settings`)
- weights: source 25, completeness 25, stage 30, activity 20 (сумма 100).
- sourceScores: REFERRAL 1, WEBSITE 0.7, EVENT 0.6, WALK_IN 0.6, SOCIAL 0.5, PHONE 0.45, ADVERTISEMENT 0.4, COLD 0.2, OTHER 0.3.
- completenessFields: phone 1, email 0.6, childName 1, desiredGradeLevel 0.8, childBirthDate 0.6.
- stageScores: NEW 0.1, CONTACTED 0.35, QUALIFIED 0.6, INTERESTED 0.85, CONVERTED 1, LOST 0.
- activity: interactionTarget 3, recencyFullDays 7, recencyZeroDays 30, interactionWeight 0.5, recencyWeight 0.5.
- bands: hot ≥ 70, warm ≥ 40 (иначе cold). Можно сбросить к умолчанию (`/reset`) и пересчитать всех (`/backfill`).

## 7. Библиотека (`GET /library/policy`)
loanDays 14, maxLoanDays 30, maxBooks 3, maxRenewals 2, renewDays 7, finePerDay 500 (сум), blockOnOverdue true, lostBookFee 0.

## 8. Расходы
`GET /expenses/approval-threshold` → threshold **1 000 000** сум.

## 9. Транспорт
`GET /transport/tariffs` → defaultAmount 0, привязка к fee type, routes [] (тарифы по маршрутам).

## 10. Зарплата (`GET /finance/payroll/engine-status`)
month 10, year 2026, timesheetAffectsPayroll **false**, workingDays 27, taxRates [] (налоговые ставки не настроены).

## 11. Переходы статусов договора (`GET /contracts/status/transitions`) — Подтверждено
| Из | В |
|---|---|
| DRAFT | DATA_MISSING, READY_FOR_REVIEW, VALIDATION_FAILED, CANCELLED, FAILED |
| DATA_MISSING | DRAFT, READY_FOR_REVIEW, VALIDATION_FAILED, CANCELLED, FAILED |
| VALIDATION_FAILED | DRAFT, DATA_MISSING, READY_FOR_REVIEW, CANCELLED, FAILED |
| READY_FOR_REVIEW | DATA_MISSING, INTERNAL_APPROVAL_PENDING, APPROVED, CHANGES_REQUESTED, CANCELLED |
| INTERNAL_APPROVAL_PENDING | APPROVED, CHANGES_REQUESTED, READY_FOR_REVIEW, CANCELLED |
| APPROVED | GENERATION_PENDING, GENERATED, CHANGES_REQUESTED, CANCELLED, FAILED |
| GENERATION_PENDING | GENERATED, APPROVED, FAILED, CANCELLED |
| GENERATED | PARENT_SIGNATURE_PENDING, DELIVERY_PENDING, EXPIRED, SUPERSEDED, ARCHIVED, CANCELLED, FAILED |
| DELIVERY_PENDING | PARENT_SIGNATURE_PENDING, GENERATED, EXPIRED, CANCELLED, FAILED |
| PARENT_SIGNATURE_PENDING | PARTIALLY_SIGNED, SCHOOL_SIGNATURE_PENDING, SIGNED, DECLINED, EXPIRED, CANCELLED |
| SCHOOL_SIGNATURE_PENDING | PARTIALLY_SIGNED, SIGNED, DECLINED, EXPIRED, CANCELLED |
| PARTIALLY_SIGNED | SIGNED, PARENT_SIGNATURE_PENDING, SCHOOL_SIGNATURE_PENDING, DECLINED, EXPIRED, CANCELLED |
| SIGNED | SUPERSEDED, ARCHIVED, CANCELLED |
| CHANGES_REQUESTED | DRAFT, READY_FOR_REVIEW, CANCELLED |
| DECLINED, EXPIRED, CANCELLED, SUPERSEDED, ARCHIVED, FAILED | — (конечные) |

## 12. Переходы статусов заявки на приём (`GET /admissions/status/transitions`) — Подтверждено
| Из | В |
|---|---|
| DRAFT | SUBMITTED, WITHDRAWN, EXPIRED |
| SUBMITTED | UNDER_REVIEW, NEEDS_FIX, REJECTED, WITHDRAWN, EXPIRED |
| UNDER_REVIEW | NEEDS_FIX, EXAM_ASSIGNED, WAITLISTED, REJECTED, WITHDRAWN, EXPIRED |
| NEEDS_FIX | SUBMITTED, UNDER_REVIEW, REJECTED, WITHDRAWN, EXPIRED |
| EXAM_ASSIGNED | EXAM_DONE, NEEDS_FIX, REJECTED, WITHDRAWN, EXPIRED |
| EXAM_DONE | ACCEPTED, WAITLISTED, REJECTED, WITHDRAWN, EXPIRED |
| ACCEPTED | CONTRACT_ISSUED, WAITLISTED, WITHDRAWN, EXPIRED |
| WAITLISTED | ACCEPTED, REJECTED, WITHDRAWN, EXPIRED |
| CONTRACT_ISSUED | CONTRACT_SIGNED, WITHDRAWN, EXPIRED |
| CONTRACT_SIGNED | ENROLLED, WITHDRAWN |
| ENROLLED | WITHDRAWN |
| REJECTED, WITHDRAWN, EXPIRED | — |

## 13. Устав монет (`GET /gamification/charter`)
Правила: монета — условный поощрительный балл, не деньги; ведёт классный руководитель или ответственный педагог; монеты обмениваются на подарки; лучших награждают по итогам месяца, четверти и года.
Категории и начисления (coins / coinsMax; auto = начисляется автоматически):
- **Академические:** GRADE_5 = 2 (auto, при выставлении оценки 5); GRADE_4 = 1 (auto); SMART_QUESTION 1; SMART_ANSWER 1; COMPETITION_1ST/2ND/3RD 5/4/3; VOCAB_10/20/30 5/10/15; TEACH_CLASS 10; OLYMPIAD 0–300; MOCK_TEST 40–140; IELTS_CEFR_SAT 0–1000.
- **Чтение:** BOOK_READ 0–300; BOOK_ESSAY 0–100; BOOK_GIFT 0–100.
- **Активность:** ORGANIZE_EVENT 0–100; EVENT_PARTICIPATE 10; EVENT_VOLUNTEER 5; PUBLIC_SPEECH 5–20; OUTSIDE_COMPETITION 0–200; CREATIVE_IDEA 3–10.
- **Творчество:** MODEL_BUILD 30–100; DRAWING 0–20; MEDIA_ARTICLE 50–100; DIRECTOR_AWARD 0–300.
Типы транзакций монет: EARNED, BONUS, SPENT, PENALTY, TRANSFER. Есть аннулирование (void, void-batch) и дневной лимит (`/gamification/coins/daily-usage`) — значение лимита не установлено.

## 14. Устав дисциплины (`GET /discipline/charter`)
- startScore **100** нравственных баллов на начало учебного года; за нарушение баллы списываются; при каждом списании куратору автоматически уходит уведомление.
- Пороги: ≤80 — индивидуальная работа психолога и воспитателя; ≤70 — звонок родителям; ≤50 — вызов родителей в школу; ≤30 — вызов родителей и письменное обязательство; 0 — исключение из школы.
- Лёгкие нарушения (штраф / макс., тяжесть): WARNING 0 MINOR; ABSENCE_OUT 2 MINOR; TOILET_MISUSE 5 MINOR; EATING_CLASS 2 MINOR; LATE_ARRIVAL 2–5 MINOR; NICKNAME 2–5 MINOR; HOMEWORK_LATE 2–5 MINOR; LYING 5 MODERATE; GOSSIP_STUDENT 5 MODERATE; PROFANITY 5–10 MODERATE; ACCESSORIES 5–10 MODERATE; ABSENCE_IN 10–15 MODERATE.
- Тяжёлые: CORRUPTION_GIFT 20 MAJOR; GOSSIP_TEACHER 20 MAJOR; DISRESPECT 10–30 MAJOR; THEFT 25–50 SEVERE; FIGHTING 25–50 SEVERE; PHONE_USE 25 MAJOR; VANDALISM 30 MAJOR; SLANDER 30 MAJOR; PROPERTY_DAMAGE 40 SEVERE; SCHOOL_ESCAPE 50 SEVERE; ROMANCE 30–60 SEVERE; WEAPON 25–50 SEVERE.
- Сброс баллов: `POST /discipline/moral-score/reset`. Группа риска: `GET /discipline/high-risk`.
- Статусы инцидента: REPORTED → INVESTIGATING → RESOLVED / APPEALED.

## 15. Типы событий (`GET /events/types`)
event, holiday, meeting, parent_meeting, exam, sports, cultural, excursion, other (видны всем); staff_leave, attestation (только сотрудникам). У каждого типа свой цвет.

## 16. Токены шаблона договора (`GET /contract-templates/tokens`)
Группы: contract (number*, day, monthName, year, academicStartYear*, academicEndYear*, academicYearLabel*, nextYear — устаревший), school (fullName*, shortName, city, licenseNumber, directorName*, stir, mfo, bankName, account, address, phones), student (fullName*, className*, grade, pinfl, documentNumber, birthDate), guardian (fullName*, phone, relationship), finance (monthlyPayment*, annualFee*, prepaidAnnualFee, forceMajeureAmount, sickDayDeduction, siblingDiscountPercent, extraTutoringFee), services (paymentMonths, paymentSeason, forceMajeurePercent, prepaymentDeadline, olympiadFirst/Second/ThirdPercent), addendum (parentNumber, subject, monthly, annual, routeNote). `*` = обязательный.
Шаблон загружается как DOCX (`/contract-templates/:id/source-docx`), имеет версии (preview, publish). Статус шаблона: DRAFT, ACTIVE, ARCHIVED.
Тарифные планы договора: MONTHLY_9 (график на 9 месяцев), ANNUAL_PREPAY (годовая предоплата), TWO_YEAR_PREPAY (оплата за 2 года — 3-й год бесплатно).

## 17. Отчёты по договорам (`GET /contract-reports/types`)
by-academic-year, by-branch, by-class, by-tariff, by-status, by-signature-method, by-campaign, unsigned, expiring-soon, overdue, declined, technical-errors, students-without-parents, students-incomplete-data, signing-conversion, avg-signing-time, notification-delivery, financial-summary, contract-without-enrollment, enrollment-without-contract.

## 18. Каталог отчётов (`GET /reports/catalog`) — 23 отчёта, форматы json/csv/excel/pdf, флаг hasPii, список ролей
sch.overview, sch.class-roster, sch.comprehensive (year, month); acad.class-grades (classId, quarterId), acad.class-ranking (classId), acad.class-comparison, acad.teacher-performance (teacherId); att.daily (date), att.chronic-absence (dateFrom, dateTo, classId, threshold — по умолчанию 5 дней), att.monthly (year, month); fin.debts, fin.payments (dateFrom, dateTo), fin.collection-rate (year, classId; начислено и собрано по месяцам); grp.grades (groupId, subjectId; распределение 5/4/3/2 и % качества), grp.ranking, grp.occupancy (вместимость = `Group.maxStudents`, иначе стандартный лимит); tr.route-load (превышение 100% = мест не хватает), tr.unassigned; std.grades, std.transcript, std.list (classId, status); sys.inactive-users (days, по умолчанию 60), sys.user-activity (источник: LoginHistory + AuditLog). В отчётах упоминается роль `TRANSPORT_MANAGER`, которой нет в RBAC-матрице (несоответствие).

## 19. Словари enum (подписи на узбекском из бандла)
- **Статус ученика:** ACTIVE, INACTIVE, GRADUATED, TRANSFERRED, EXPELLED (на фронте также встречается ON_LEAVE).
- **События движения ученика (enrollment):** ADMITTED, PROMOTED, REPEATED, TRANSFERRED_IN, TRANSFERRED_OUT, WITHDRAWN, GRADUATED, CLASS_CHANGED, RESTORED.
- **Решение по переводу (promotion):** PROMOTED, RETAINED, CONDITIONAL_PROMOTION, TRANSFERRED_OUT, GRADUATED, ACADEMIC_LEAVE, EXPELLED, SKIPPED.
- **Статус пакета перевода:** DRAFT, VALIDATING, READY, APPROVAL_PENDING, APPROVED, EXECUTING, COMPLETED, FAILED, CANCELLED, ROLLED_BACK.
- **Итоговая оценка (term grade):** DRAFT, CALCULATED, NOT_ENOUGH, TEACHER_APPROVED, APPROVED, LOCKED, REOPENED.
- **Табель (report card):** DRAFT, GENERATED, APPROVED, ISSUED, ARCHIVED.
- **Тип оценки:** EXAM, QUIZ, HOMEWORK, PROJECT, PARTICIPATION, MIDTERM, FINAL.
- **Посещаемость ученика:** PRESENT, ABSENT, LATE, EXCUSED, SICK.
- **Разрешение на отсутствие:** причина MEDICAL / FAMILY / OFFICIAL / OTHER; статус PENDING, APPROVED, PARTIALLY_APPROVED, REJECTED (CANCELLED).
- **Родство:** FATHER, MOTHER, GUARDIAN, GRANDFATHER, GRANDMOTHER, UNCLE, AUNT, OTHER.
- **Основание представительства (guardian authority):** BIRTH_CERT, GUARDIANSHIP, POWER_OF_ATTORNEY, COURT_ORDER, OTHER; статус ACTIVE / EXPIRED / CANCELLED.
- **Документ ученика:** BIRTH_CERTIFICATE, ID_CARD, PASSPORT, FOREIGN_DOCUMENT.
- **Тип группы:** SUBGROUP, ELECTIVE, OLYMPIAD, CLUB, REMEDIAL. **Разбиение класса на группы:** MANUAL, ALPHABET, LEVEL, GENDER, BALANCED.
- **Категория учителя:** INTERN, SPECIALIST, SENIOR, METHODIST, MASTER.
- **Конфликты расписания:** тип TEACHER / ROOM / CLASS / STUDENT; разрешение REASSIGN_TEACHER / CHANGE_ROOM / MOVE_SLOT.
- **Дни:** MONDAY … SUNDAY (в расписании MONDAY–SATURDAY).
- **Категория fee type:** TUITION, REGISTRATION, LIBRARY, TRANSPORT, CAFETERIA (MEAL/MEALS), UNIFORM, EXTRACURRICULAR / ACTIVITY / EXTRA_CLASS, BOOKS, OTHER (в разных экранах разные наборы — несогласованность).
- **Периодичность:** MONTHLY, QUARTERLY, SEMESTER, YEARLY, ONE_TIME.
- **Тип скидки:** SIBLING, SCHOLARSHIP, STAFF_CHILD, EARLY_PAYMENT, SOCIAL, ACADEMIC, SPORT, ORPHAN, DISABILITY, MULTI_YEAR, PROMOTIONAL, OTHER. Статус назначения скидки: PENDING / APPROVED / REJECTED / (revoked).
- **Счёт (invoice):** DRAFT, PENDING, SENT, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED.
- **Платёж:** PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED. Способы: CASH, CARD, TRANSFER/BANK_TRANSFER, CLICK, PAYME, UZUM.
- **Источник тарифа в договоре:** FEE_TYPE, PROFILE, SCHOOL_DEFAULT, NONE.
- **Проверка готовности к кампании договоров:** READY, DATA_MISSING, DUPLICATE, NO_GUARDIAN, PHONE_UNVERIFIED, NO_TARIFF.
- **Действие закрытия года:** ARCHIVE, SUPERSEDE, SKIP.
- **Способ подписи:** OTP, ERI (ЭЦП), CLICK_ACCEPT, IN_PERSON. **Сторона подписи:** SCHOOL, PARENT, STUDENT, WITNESS.
- **Доп. соглашение:** PENDING, APPROVED, SIGNATURE_PENDING, APPLIED, REJECTED, CANCELLED.
- **Расход:** DRAFT, PENDING, APPROVED, PAID, CANCELLED (+REJECTED).
- **Зарплатная ведомость:** DRAFT, PENDING, APPROVED, PAID, CANCELLED.
- **Сотрудник:** ACTIVE, ON_LEAVE, RESIGNED, TERMINATED. Тип занятости: MAIN, PART_TIME, EXTERNAL, CONTRACT, HOURLY, INTERN. Категория должности: MANAGEMENT, PEDAGOGICAL, ADMINISTRATIVE, FINANCIAL, TECHNICAL, MEDICAL, SERVICE, SECURITY, OTHER. Группы ролей: MANAGEMENT, ACADEMIC_STAFF, FINANCE_STAFF, SUPPORT_STAFF, SERVICE_STAFF, PORTAL.
- **Отпуск:** ANNUAL, SICK, UNPAID, MATERNITY, PATERNITY, STUDY, BUSINESS_TRIP, CREATIVE, CHILD_CARE, OTHER; статус PENDING / APPROVED / REJECTED / CANCELLED. План отпусков: PLANNED / CONFIRMED / USED / CANCELLED.
- **Посещаемость сотрудника:** PRESENT, ABSENT, LATE, LEAVE, HALF_DAY, SICK, HOLIDAY, REMOTE. **Табель:** DRAFT, SUBMITTED, APPROVED, LOCKED.
- **Трудовой договор:** DRAFT, ACTIVE, EXPIRED, TERMINATED, SUSPENDED. **Документ сотрудника:** CONTRACT, PASSPORT, DIPLOMA, CERTIFICATE, MEDICAL, OTHER.
- **Аттестация:** ATTESTATION, QUALIFICATION, TRAINING, LICENSE; результат PASSED / FAILED / PENDING.
- **Вакансия:** OPEN, ON_HOLD, CLOSED, CANCELLED. **Кандидат:** APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED.
- **Лид (приём):** NEW, CONTACTED, QUALIFIED, INTERESTED (или TOUR_SCHEDULED/APPLIED в другой версии экрана), CONVERTED, LOST. Источник: WEBSITE, PHONE, REFERRAL, SOCIAL, INSTAGRAM, TELEGRAM, WALK_IN, EVENT, ADVERTISEMENT, COLD, OTHER.
- **Взаимодействие с лидом:** CALL, CHAT, EMAIL, NOTE, MEETING, SMS. **Задача:** OPEN / DONE / CANCELLED; приоритет CRITICAL / HIGH / NORMAL / LOW.
- **Слот встречи:** INTERVIEW, EXAM, TOUR, CONSULT/MEETING. **Интервью:** SCHEDULED, DONE, CANCELLED, NO_SHOW.
- **Предложение (offer):** DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED, CANCELLED.
- **Документ заявки:** BIRTH_CERTIFICATE, PHOTO, PASSPORT, MEDICAL, PREVIOUS_TRANSCRIPT, OTHER; статус PENDING, REQUESTED, APPROVED, REJECTED, WAIVED, REPLACEMENT_REQUIRED.
- **Вступительный экзамен:** DRAFT, SCHEDULED, ACTIVE, COMPLETED, GRADED, CANCELLED; вопросы MULTIPLE_CHOICE / TRUE_FALSE / SHORT_ANSWER; назначение ASSIGNED / IN_PROGRESS / SUBMITTED / GRADED / ABSENT.
- **Школьный экзамен:** тип QUIZ, MIDTERM, FINAL, ASSIGNMENT, PRACTICAL, ORAL; статус DRAFT, SCHEDULED, ONGOING, COMPLETED, CANCELLED, GRADED.
- **Домашнее задание (сдача):** PENDING, SUBMITTED, RECORDED (учитель принял офлайн), GRADED, OVERDUE / LATE.
- **Дисциплина (старый справочник):** LATE, ABSENCE, UNIFORM, BEHAVIOR, FIGHTING, BULLYING, CHEATING, DAMAGE, PHONE, SMOKING, OTHER; тяжесть MINOR … SEVERE, CRITICAL.
- **Библиотека, экземпляр:** AVAILABLE, BORROWED, RESERVED, DAMAGED, LOST.
- **Транспорт:** рейс PLANNED / IN_PROGRESS / COMPLETED / CANCELLED; посадка PENDING, ON_BOARD (BOARDED), DROPPED_OFF, NO_SHOW; документы ТС TECH_INSPECTION, INSURANCE, LICENSE, TACHOGRAPH, OTHER (срок EXPIRED / EXPIRING / VALID / NO_EXPIRY).
- **Семейные миссии:** частота DAILY / WEEKLY / MONTHLY / ONE_TIME; категория READING, LEARNING, CREATIVITY, HEALTH, BONDING, CHALLENGE; выполнение PENDING / APPROVED / REJECTED.
- **Модерация:** причина CHILD_SAFETY, HARASSMENT, INAPPROPRIATE, VIOLENCE, SPAM, OTHER; объект MESSAGE / STORY / STORY_COMMENT; действие NONE / MESSAGE_REMOVED / USER_WARNED / USER_SUSPENDED; статус PENDING / REVIEWING / RESOLVED / DISMISSED.
- **Объявление:** DRAFT, SCHEDULED, PUBLISHED, ARCHIVED; приоритет LOW / NORMAL / HIGH / URGENT.
- **SMS-шаблон (тип):** GENERAL, OTP, ATTENDANCE, GRADE, PAYMENT, ANNOUNCEMENT, CONTRACT, REMINDER.
- **Аудит:** CREATE, UPDATE, DELETE, LOGIN, LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET (+STATUS_CHANGE); результат входа SUCCESS / FAILED / BLOCKED.
- **Устройство (push):** ANDROID, IOS, WEB. **Комментарий к новости:** VISIBLE, HIDDEN, DELETED.
