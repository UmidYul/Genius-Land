# Документ E. Концептуальная модель данных

> Это **концептуальная модель, восстановленная по JSON-ответам API**. Фактическая схема БД недоступна. Признаки: PostgreSQL (`/settings/system`), ORM в стиле Prisma (`_count`, вложенные include, UUID-ключи, camelCase и местами snake_case — `group_id`, `bulk_batch_id`). Имена атрибутов ниже — это ключи JSON из API (подтверждено). Названия сущностей — мои (они совпадают с тем, как сущности названы в текстах API: Student, Employee, Teacher, Group, LoginHistory, AuditLog и др.).

## 1. Основные сущности и атрибуты (подтверждено ответами API)

**School** — id, code, name, shortName, logo, address, phone, email, website, description, директор (directorOfSchool у User), реквизиты (stir, mfo, bankName, account, licenseNumber, city), подпись директора и печать (файлы), settings.

**AcademicYear** — id, name, startDate, endDate, isCurrent; 1:N Class, Quarter.
**Quarter** — (есть счётчик `quarters`); атрибуты не получены.

**User** — id, customId (GL ID), email, phone, firstName, lastName, middleName, role (37 значений), avatar, isActive, isVerified, lastLogin, failedLogins / failedLoginAttempts, lockedUntil, createdAt, updatedAt. Связи 1:1 (опционально) со Student, Parent, Teacher, Employee. Дополнительные роли (users.role.assign) — Г.
**Session** — id, deviceType, browser, os, ipAddress, location, lastActiveAt, createdAt, isCurrent.
**LoginHistory** — (источник отчёта sys.user-activity); атрибуты не получены.
**AuditLog** — id, action, entity, entityId, oldData (json), newData (json), ipAddress, userAgent, userId, createdAt.
**Device** (push) — platform ANDROID / IOS / WEB.

**Student** — id, studentId (GL-xxxxxx), firstName, lastName, middleName, dateOfBirth, gender, address, phone, email, avatar, enrollmentDate, status, previousSchool, bloodType, allergies, medicalNotes, emergencyContact, emergencyPhone, hasDisability, pinfl, nationality, citizenship, birthRegion, birthDistrict, documentType, documentSeries, documentNumber, totalCoins, currentCoins, moralScore, level, experiencePoints, classId, userId, archivedAt, archiveReason, archiveNotes, transferredTo, graduationDate, withdrawalDate, finalSettlement, settlementDate, settlementNotes, lastActiveDate, createdAt, updatedAt, deletedAt.
**Parent** — id, firstName, lastName, middleName, phone, email, address, workplace, occupation, userId, phoneVerified, profileCompleted, phoneChangedAt.
**StudentParent** — id, studentId, parentId, relationship, isPrimary, createdAt.
**GuardianAuthority** — основание (BIRTH_CERT…), статус ACTIVE / EXPIRED / CANCELLED, canSign; связь Parent–Student (Г по деталям).

**Teacher** — id, employeeId, ФИО, dateOfBirth, gender, phone, email, address, avatar, qualification, experience, specialization, hireDate, status, salary, bankAccount, passportNumber, inn, inps, userId.
**TeacherSubject** — id, teacherId, subjectId, isPrimary.
**Employee** — id, employeeId, ФИО, gender, dateOfBirth, position (текст), positionId, department (текст), departmentId, phone, email, address, avatar, hireDate, baseSalary, rate, employmentType, status, bankAccount, passportNumber, inn, pinfl, inps, terminationDate, terminationReason, teacherId, userId, schoolId, deletedAt.
**EmployeeDocument** — type, file, сроки (expiring).
**Department** — name, code, parentId (иерархия), sortOrder, description, isActive.
**Position** — name, code, category, departmentId, tariffGrade (1–22), baseRate, sortOrder, isPedagogical, isActive.
**StaffingRow** — departmentId, positionId, plannedRate, baseSalary, description, isActive.
**Vacancy** / **Applicant** — title, department, position, employmentType, salaryFrom / To, description, requirements, status; applicant stage.
**EmploymentContract** (hr) — employeeId, number, employmentType, status, startDate, endDate, probationEnd, salary, notes, file, amendments.
**Certification** — employeeId, type, name, category, issuer, issuedAt, validUntil, result, score, file.
**LeaveBalance**, **LeavePlan**, **Leave** — тип, дни (allocated, carriedOver), период, статус.
**StaffAttendance** — employeeId, date, status.
**Timesheet** — employeeId, month, year, status (DRAFT / SUBMITTED / APPROVED / LOCKED).
**WorkSchedule** — employeeId, график.
**Payroll** — employeeId, month, year, суммы (gross, deductions, net — Г), status.

**Class** — id, name, gradeLevel, section, roomNumber, capacity, classTeacherId, academicYearId, isActive.
**Group** — id, name, description, type, isActive, teacherId, academicYearId, classId, maxStudents, splitRule; M:N Student; M:N Subject (+ teacher и hoursPerWeek на предмет).
**Subject** — id, code, name, description, gradeLevel[], hoursPerWeek, isActive, isElective.
**Schedule** — id, dayOfWeek, startTime, endTime, lessonNumber, room, notes, classId, groupId, subjectId, teacherId, isActive.
**LessonTime** — lesson, start, end, label (сетка звонков).

**Attendance** — id, date, status, checkInTime, checkOutTime, notes, studentId, classId, groupId, markedById, teacherId. Уникальность (studentId, date) — П. Поурочная посещаемость (`attendance/lessons`) — отдельная сущность LessonAttendance (Г).
**AbsencePermit** — studentId, reason, период, status, deductions.
**Grade** — id, score, maxScore, percentage, letterGrade, type, title, description, date, comments, studentId, subjectId, classId, groupId, teacherId, quarterId, createdById, status.
**GradeHistory** — id, gradeId, oldValue, newValue, oldStatus, newStatus, reason, changedById, approvedById, createdAt.
**GradePolicy** — scope, termMethod, annualMethod, typeWeights (json), minGradesRequired, examWeight.
**TermGrade** / **AnnualGrade** — studentId, subjectId, quarter / year, value, status (DRAFT…LOCKED).
**ReportCard** — studentId, period, status, version, pdf.
**Enrollment** (движение) — studentId, type (ADMITTED…RESTORED), fromClass, toClass, date.
**StatusHistory** — studentId, oldStatus, newStatus.
**PromotionBatch** + **PromotionDecision** — статус пакета; решение по ученику.
**Homework** — id, title, description, dueDate, maxScore, attachments[], isPublished, subjectId, classId, groupId, teacherId; **HomeworkSubmission** — status, score.
**Exam** — id, title, description, type, status, totalMarks, passingMarks, duration, startDate, endDate, instructions, room, isPublished, subjectId, classId, teacherId; **ExamQuestion**; **ExamAttempt**.

**CoinTransaction** — type (EARNED / BONUS / SPENT / PENALTY / TRANSFER), amount, reason (с меткой источника `[AVTO:GRADE:id]`), studentId, кто выдал; void.
**Achievement**, **StudentAchievement**, **Challenge**, **Reward** (id, name, description, cost, icon, category, stock, isActive), **RewardPurchase**.
**FamilyMission** (каталог) и **MissionCompletion** (доказательство, статус).
**DisciplineRecord** — id, type, description, severity, status, date, actionTaken, coinPenalty, moralPenalty, moralBefore, moralAfter, notes, studentId, reportedById, group_id, bulk_batch_id.

**FeeType** — id, name, description, amount, currency, category, frequency, isActive.
**StudentFee** (назначение) — id, studentId, feeTypeId, customAmount, discountAmount, discountReason, startDate, endDate, isActive.
**DiscountType** — id, name, description, category, discountPercent, fixedAmount, isPercentage, maxAmount, minAmount, validFrom, validUntil, isActive, requiresApproval, priority, canCombine, appliesTo[].
**StudentDiscount** — id, studentId, discountTypeId, customPercent, customAmount, startDate, endDate, isActive, approvedById, approvedAt, notes, attachments[].
**FinancialProfile** — id, studentId, monthlyTuition, monthlyTransport, monthlyMeals, monthlyOther, monthlyTotal, totalDiscountPercent, totalDiscountAmount, netMonthlyAmount, currentBalance, lastPaymentDate, lastPaymentAmount, totalPaid, totalDue, totalDiscount, preferredPaymentMethod, autoPayEnabled, paymentNotes.
**StudentAccount** (леджер) — id, accountNumber (ACC-GL-xxxxxx), balance, totalDebited, totalCredited; **LedgerEntry** — type DEBIT / CREDIT, amount, description, ссылка на счёт или платёж.
**Invoice** — id, invoiceNumber, month, year, periodStart, periodEnd, subtotal, discountTotal, totalAmount, paidAmount, balanceDue, currency, status, dueDate, sentAt, paidAt, notes, studentId, createdById, deletedAt; уникальность (studentId, month, year) — П.
**InvoiceItem** — id, description, quantity, unitPrice, subtotal, discountAmount, total, invoiceId, feeTypeId.
**Payment** — id, paymentId, type, amount, currency, status, method, month, year, dueDate, paidDate, paidAmount, description, receiptNumber, transactionId, notes, metadata, studentId, invoiceId, processedById, deletedAt.
**Expense**, **Budget** (статьи по месяцам), **Cashbox**, **CashboxShift** / Closing, **CashTransaction**, **BankAccount**, **BankStatement** / строки, **ReconciliationSession** / Item.
**FinanceAutomationSettings** (E01 §4), **AutomationLog**.

**Contract** — номер, ученик, родитель или опекун, учебный год, статус (20), план оплаты, суммы, скидки, кампания, шаблон и версия, документ, подписи; **ContractSigner** (сторона, метод, доказательства: OTP, селфи, рисованная подпись), **ContractAudit**, **ContractDelivery**, **ContractAmendment**, **ContractAddendum**, **ContractTemplate** + **TemplateVersion** (DOCX), **ContractCampaign**, **EnforcementCase**, **ContractYearClose**.

**Lead**, **LeadInteraction**, **AdmissionTask**, **Application** (+ StatusHistory, Document, Interview, Offer, Payment / депозит, Sibling), **Intake**, **AdmissionExam** (+ Question, Assignment, Seating), **Slot** (+ Booking), **Waitlist**, **LeadScoringSettings**.

**Vehicle** (+ VehicleDocument), **Route**, **RouteStop**, **TransportAssignment** (ученик ↔ маршрут / остановка), **Trip**, **Boarding**, **Ticket**, **TransportTariff**.
**Book** (+ cover), **BookCategory**, **Borrowing**, **LibraryPolicy**.
**MealTime** (id, mealType, startTime, endTime, sortOrder, isActive, color, description, icon, name, nameUz, code), **DishCategory**, **Dish**, **Menu**, **MenuItem**.

**Conversation** (id, name, type PRIVATE / GROUP / SCOPE, avatar, isGroup, scopeType) + **Participant** (isAdmin, mute), **Message** (content, attachments, voice, isDeleted, pinned), **ModerationReport**, **UserBlock**.
**Notification** — id, title, body, type, data (json: link), isRead, readAt, userId, senderId, priority, channels[], entityType, entityId, groupKey.
**NotificationTemplate**, **SmsTemplate**, **SmsLog** (id, phone, message, provider ESKIZ, status, messageId, externalId, error, errorMessage, type, metadata, studentId, userId), **NotificationPreference**, **QuietHours**.
**Announcement**, **News** (+ media, comments, reactions), **Story** (+ views, likes, comments), **Event** (тип, даты, время, аудитория, статус).
**Setting** (ключ–значение), **Backup**.

## 2. Связи

| Сущность A | Связь | Сущность B | Кардинальность | Основание | Уверенность |
|---|---|---|---|---|---|
| AcademicYear | содержит | Class | 1:N | academicYearId, _count.classes | П |
| AcademicYear | содержит | Quarter | 1:N | _count.quarters | П |
| Class | классный руководитель | Teacher | N:1 (опц.) | classTeacherId | П |
| Class | содержит | Student | 1:N | classId | П |
| Class | содержит | Group | 1:N (опц.) | classId | П |
| Student | ↔ | Parent | M:N через StudentParent | parents[] | П |
| Student | ↔ | Group | M:N | groups/:id/students | П |
| Student | 1:1 | User | опц. | userId | П |
| Parent / Teacher / Employee | 1:1 | User | опц. | userId | П |
| Employee | 0..1 | Teacher | опц. | teacherId | П |
| Teacher | ↔ | Subject | M:N через TeacherSubject | subjects[] | П |
| Group | ↔ | Subject | M:N (+ учитель на предмет) | subjectTeachers | П |
| Schedule | → | Class / Group, Subject, Teacher | N:1 | ключи | П |
| Attendance | → | Student, Class / Group, User (markedBy) | N:1 | ключи | П |
| Grade | → | Student, Subject, Class / Group, Teacher, Quarter, User | N:1 | ключи | П |
| Grade | 1:N | GradeHistory | | gradeId | П |
| Grade | 1:0..1 | CoinTransaction (авто) | | метка [AVTO:GRADE] | П |
| Attendance (LATE / ABSENT) | 1:0..1 | DisciplineRecord (авто) | | T-ATT-02 | П |
| DisciplineRecord | → | Student, User (reportedBy) | N:1 | | П |
| Student | 1:1 | FinancialProfile | | profile.studentId | П |
| Student | 1:1 | StudentAccount | | ACC-GL-… | П |
| StudentAccount | 1:N | LedgerEntry | | entries | П |
| Student | ↔ | FeeType | M:N через StudentFee | | П |
| Student | ↔ | DiscountType | M:N через StudentDiscount | | П |
| Invoice | 1:N | InvoiceItem → FeeType | | items | П |
| Invoice | 1:N | Payment | | invoiceId | П |
| Student | 1:N | Invoice, Payment | | | П |
| Contract | → | Student, Parent, AcademicYear, Template version, Campaign | N:1 | отчёты, токены | ЧП |
| Contract | 1:N | Signer, Amendment, Addendum, Audit, Delivery | | эндпоинты | ЧП |
| Lead | 1:N | Interaction, Task; 1:0..1 Application | | convert | ЧП |
| Application | 1:N | Document, Interview, Offer, Payment; 0..1 → Student, Contract | | | ЧП |
| Route | 1:N | RouteStop; M:N Vehicle; 1:N TransportAssignment | | | ЧП |
| Trip | → | Vehicle, Route, Driver (User); 1:N Boarding | | | ЧП |
| Book | 1:N | Borrowing → Student | | | ЧП |
| Menu | 1:N | MenuItem → Dish, MealTime | | | ЧП |
| Conversation | M:N | User (Participant); 1:N Message | | | П |
| Notification | → | User (recipient), User (sender) | N:1 | | П |
| AuditLog | → | User | N:1 | | П |

## 3. ER-диаграмма (ядро)

```mermaid
erDiagram
  SCHOOL ||--o{ ACADEMIC_YEAR : has
  ACADEMIC_YEAR ||--o{ CLASS : contains
  ACADEMIC_YEAR ||--o{ QUARTER : splits
  CLASS ||--o{ STUDENT : enrolls
  CLASS }o--o| TEACHER : "class teacher"
  CLASS ||--o{ GROUP : "split into"
  GROUP }o--o{ STUDENT : members
  GROUP }o--o{ SUBJECT : teaches
  STUDENT }o--o{ PARENT : "STUDENT_PARENT"
  PARENT ||--o{ GUARDIAN_AUTHORITY : "may sign"
  USER |o--o| STUDENT : login
  USER |o--o| PARENT : login
  USER |o--o| TEACHER : login
  USER |o--o| EMPLOYEE : login
  EMPLOYEE |o--o| TEACHER : "is"
  EMPLOYEE }o--o| POSITION : holds
  EMPLOYEE }o--o| DEPARTMENT : "works in"
  TEACHER }o--o{ SUBJECT : "TEACHER_SUBJECT"
  SCHEDULE }o--|| SUBJECT : of
  SCHEDULE }o--|| TEACHER : by
  SCHEDULE }o--o| CLASS : for
  SCHEDULE }o--o| GROUP : for
  ATTENDANCE }o--|| STUDENT : of
  GRADE }o--|| STUDENT : of
  GRADE }o--|| SUBJECT : in
  GRADE }o--o| QUARTER : during
  GRADE ||--o{ GRADE_HISTORY : audited
  GRADE ||--o| COIN_TRANSACTION : "auto reward"
  ATTENDANCE ||--o| DISCIPLINE_RECORD : "auto LATE/ABSENT"
  DISCIPLINE_RECORD }o--|| STUDENT : about
  COIN_TRANSACTION }o--|| STUDENT : for
  STUDENT ||--|| FINANCIAL_PROFILE : has
  STUDENT ||--|| STUDENT_ACCOUNT : ledger
  STUDENT_ACCOUNT ||--o{ LEDGER_ENTRY : entries
  STUDENT }o--o{ FEE_TYPE : "STUDENT_FEE"
  STUDENT }o--o{ DISCOUNT_TYPE : "STUDENT_DISCOUNT"
  STUDENT ||--o{ INVOICE : billed
  INVOICE ||--o{ INVOICE_ITEM : lines
  INVOICE_ITEM }o--|| FEE_TYPE : from
  INVOICE ||--o{ PAYMENT : "paid by"
  STUDENT ||--o{ CONTRACT : "contracted"
  CONTRACT ||--o{ CONTRACT_SIGNER : signatures
  CONTRACT ||--o{ CONTRACT_AMENDMENT : amendments
  CONTRACT }o--|| TEMPLATE_VERSION : rendered_from
  LEAD ||--o| APPLICATION : converts
  APPLICATION ||--o| STUDENT : enrolls_as
  ROUTE ||--o{ ROUTE_STOP : stops
  ROUTE ||--o{ TRANSPORT_ASSIGNMENT : riders
  TRANSPORT_ASSIGNMENT }o--|| STUDENT : rider
  BOOK ||--o{ BORROWING : lent
  BORROWING }o--|| STUDENT : to
  USER ||--o{ AUDIT_LOG : actions
  USER ||--o{ NOTIFICATION : receives
```

## 4. Ограничения целостности (наблюдаемые)
- UNIQUE Class.name (409) — П; UNIQUE FeeType.name — П; UNIQUE StudentFee(studentId, feeTypeId) — П; UNIQUE Invoice(studentId, month, year) — П; UNIQUE Attendance(studentId, date) — П (upsert); UNIQUE User.email, User.phone — ЧП (тексты UI); UNIQUE Employee.pinfl — ЧП; UNIQUE ContractTemplate.code — ЧП; UNIQUE RouteStop(routeId, name) — ЧП.
- Отсутствующие ограничения (дефекты): Class.gradeLevel без диапазона, capacity = 0 заменяется на 30, FeeType.amount ≥ 0 не проверяется, DiscountType.discountPercent ≤ 100 не проверяется, Grade.score ≤ maxScore не проверяется, Student.dateOfBirth не может быть в будущем — не проверяется.

## 5. Жизненные циклы
См. E01 §11–12 (договор, заявка) и enum-ы (§19). Сводка по главным сущностям:
- **Student:** ACTIVE → (TRANSFERRED | EXPELLED | GRADUATED | INACTIVE); архив (archivedAt) → restore. События движения пишутся в Enrollment (кроме создания — BR-012).
- **Invoice:** (DRAFT) → PENDING → SENT → PARTIALLY_PAID → PAID; PENDING / SENT → OVERDUE (процесс); → CANCELLED.
- **Payment:** PENDING → COMPLETED / PAID; PENDING → CANCELLED / FAILED; REFUNDED (enum, механизм не найден).
- **TermGrade:** DRAFT → CALCULATED / NOT_ENOUGH → TEACHER_APPROVED → APPROVED → LOCKED → REOPENED → …
- **PromotionBatch:** DRAFT → VALIDATING → READY → APPROVAL_PENDING → APPROVED → EXECUTING → COMPLETED / FAILED; → ROLLED_BACK; → CANCELLED.
- **DisciplineRecord:** REPORTED → INVESTIGATING → RESOLVED | APPEALED.
- **Leave:** PENDING → APPROVED / REJECTED / CANCELLED. **Timesheet:** DRAFT → SUBMITTED → APPROVED → LOCKED.
- **Lead:** NEW → CONTACTED → QUALIFIED → INTERESTED → CONVERTED / LOST.
- **Trip:** PLANNED → IN_PROGRESS → COMPLETED; → CANCELLED; delay.
