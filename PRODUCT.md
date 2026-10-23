# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Staff use the platform in a browser on both phones and computers, so every staff workflow must work fully at phone width as well as on desktop. A separate parent and student app comes later. Its platform (native or web) is undecided.

## Stack

Delegated: **Next.js (App Router) + TypeScript, PostgreSQL via Prisma, and next-intl for Uzbek/Russian.** Why: one codebase serves the staff web app now and can expose an API for the parent/student app later. Role-based access and server-rendered pages suit a data-heavy internal tool. PostgreSQL fits the relational shape of the data (students, classes, subjects, grades, payments). Hosting target is undecided.

## Users

Genius Land is a private school in Margilan, Uzbekistan, with about 600–750 students. Teaching is in Russian.

Primary users (v1):
- **Teachers**: record grades, lesson topics, and attendance for their classes and subjects. They do this on their phone during or right after a lesson, and on a computer in the staff room.
- **Administrators**: manage classes, subjects, the timetable, teacher assignments, and student rosters, and oversee school-wide records.
- **Accountant**: tracks tuition contracts, monthly fees, payments, and outstanding debts per student.

Later audiences (not in v1):
- **Parents**: follow their child's grades, attendance, schedule, and other school information.
- **Students**: use the app at home. Phones are not allowed during school time, so student use happens outside school hours.

## Product Purpose

An in-house school management platform that does for Genius Land what e-maktab.uz does for state schools: an electronic journal plus school administration in one place. It replaces paper journals and scattered records with one source of truth for academic and financial data. Success means teachers fill the journal quickly on whatever device they have, administrators and the accountant see accurate, current records, and that data is ready to give parents visibility when their app ships.

## Positioning

Built for one private school, not a generic multi-school system. It covers what a private school needs and a state e-journal doesn't: tuition contracts, fees, and debts sit next to grades and attendance. It fits Genius Land's own classes, timetable, and roles exactly.

## Operating Context

- Teachers use it in short bursts between and after lessons, often one-handed on a phone, and in longer desktop sessions in the staff room.
- Academic work follows the Uzbek school structure: grades/classes with parallel classes per grade, subjects, a weekly timetable, academic quarters, and a school year.
- Instruction and academic content are in Russian. The interface must be available in Uzbek and Russian.
- Familiar reference: e-maktab.uz, the state electronic journal staff and parents in Uzbekistan already know.

## Capabilities and Constraints

V1 modules (confirmed):
1. **Journal and grades**: per class and subject, grades and lesson topics.
2. **Attendance**: absences and lateness.
3. **Schedule and classes**: timetable, classes, subjects, teacher assignments, student roster.
4. **Tuition and payments**: contracts, monthly fees, payments, debts.

Constraints:
- Role-based access: teacher, administrator, accountant now; parent and student roles later.
- Bilingual UI: Uzbek (Latin script) and Russian.
- Scale: one school, about 600–750 students, several parallel classes per grade.
- Data shape and access should let the future parent/student app reuse them.

Open decisions (do not assume):
- Grading scale and how quarter/year grades are calculated.
- Whether attendance is marked per lesson or per day.
- Fee structure (monthly vs. other periods, discounts, siblings), payment methods, and any integrations (e.g. Click, Payme).
- Homework, announcements, and messaging: not in v1 scope unless added.
- Hosting/deployment target.
- Parent/student app platform and timeline.

## Brand Commitments

- Name: **Genius Land**.
- A Genius Land logo exists and must be used. Files are not yet in the repository; add them when provided. No binding colors or fonts have been specified.

## Evidence on Hand

- No real data, screenshots, or assets are in the repository yet. The logo is pending.
- Do not invent student names, grades, payment figures, or school statistics as if they were real. Clearly mark any placeholder data as such.

## Product Principles

1. **Fast entry over feature breadth.** Recording a lesson's grades and attendance should take seconds on a phone. Daily teacher actions get priority.
2. **One source of truth.** Academic and financial records live together and agree with each other. No duplicate entry across modules.
3. **Familiar to Uzbek school staff.** Follow the conventions staff already know from e-maktab and paper journals before inventing new ones.
4. **Bilingual from day one.** Uzbek and Russian are equal. No hard-coded strings, and layouts must survive the longer of the two.
5. **Built for the parents' app later.** Model data and permissions now so parent and student access is an extension, not a rewrite.
