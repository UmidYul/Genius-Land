-- Student numbers GL-000001…: one school-wide sequence, never reused.
CREATE SEQUENCE "student_number_seq" START 1;

-- CreateEnum
CREATE TYPE "CalendarDayKind" AS ENUM ('HOLIDAY', 'WORKDAY');

-- CreateEnum
CREATE TYPE "ClassType" AS ENUM ('REGULAR', 'DIRECTION_GROUP');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'LEFT', 'GRADUATED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "GuardianRelation" AS ENUM ('MOTHER', 'FATHER', 'GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentEventKind" AS ENUM ('ENROLLED', 'TRANSFER', 'STATUS');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('CLASSES', 'STAFF', 'STUDENTS', 'GUARDIANS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDay" (
    "id" UUID NOT NULL,
    "branchId" UUID,
    "date" DATE NOT NULL,
    "kind" "CalendarDayKind" NOT NULL,
    "classType" "ClassType",
    "note" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "nameUz" VARCHAR(120) NOT NULL,
    "nameRu" VARCHAR(120) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Direction" (
    "id" UUID NOT NULL,
    "nameUz" VARCHAR(120) NOT NULL,
    "nameRu" VARCHAR(120) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Direction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "type" "ClassType" NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "nameKey" VARCHAR(60) NOT NULL,
    "gradeLevel" INTEGER,
    "directionId" UUID,
    "capacity" INTEGER NOT NULL,
    "homeroomTeacherId" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "userId" UUID,
    "fullName" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(13) NOT NULL,
    "position" VARCHAR(120) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "number" VARCHAR(12) NOT NULL DEFAULT ('GL-'::text || lpad((nextval('student_number_seq'::regclass))::text, 6, '0'::text)),
    "branchId" UUID NOT NULL,
    "classId" UUID,
    "gradeLevel" INTEGER NOT NULL,
    "lastName" VARCHAR(80) NOT NULL,
    "firstName" VARCHAR(80) NOT NULL,
    "middleName" VARCHAR(80),
    "birthDate" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "emergencyContactName" VARCHAR(160),
    "emergencyContactPhone" VARCHAR(13),
    "userId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianLink" (
    "id" UUID NOT NULL,
    "guardianId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "relation" "GuardianRelation" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentHistory" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "kind" "StudentEventKind" NOT NULL,
    "fromClassId" UUID,
    "toClassId" UUID,
    "fromStatus" "StudentStatus",
    "toStatus" "StudentStatus",
    "date" DATE NOT NULL,
    "reason" VARCHAR(500),
    "actorId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "actorId" UUID NOT NULL,
    "fileName" VARCHAR(200) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "rows" JSONB NOT NULL,
    "report" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_branchId_name_key" ON "AcademicYear"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Term_academicYearId_number_key" ON "Term"("academicYearId", "number");

-- CreateIndex
CREATE INDEX "CalendarDay_date_idx" ON "CalendarDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_branchId_date_classType_key" ON "CalendarDay"("branchId", "date", "classType");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_nameRu_key" ON "Subject"("nameRu");

-- CreateIndex
CREATE UNIQUE INDEX "Direction_nameRu_key" ON "Direction"("nameRu");

-- CreateIndex
CREATE INDEX "Class_branchId_academicYearId_idx" ON "Class"("branchId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_branchId_academicYearId_nameKey_key" ON "Class"("branchId", "academicYearId", "nameKey");

-- CreateIndex
CREATE INDEX "Staff_userId_idx" ON "Staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_branchId_phone_key" ON "Staff"("branchId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_branchId_userId_key" ON "Staff"("branchId", "userId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_staffId_idx" ON "TeachingAssignment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_classId_subjectId_staffId_key" ON "TeachingAssignment"("classId", "subjectId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_number_key" ON "Student"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_branchId_classId_status_idx" ON "Student"("branchId", "classId", "status");

-- CreateIndex
CREATE INDEX "Student_lastName_firstName_birthDate_idx" ON "Student"("lastName", "firstName", "birthDate");

-- CreateIndex
CREATE INDEX "GuardianLink_studentId_idx" ON "GuardianLink"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianLink_guardianId_studentId_key" ON "GuardianLink"("guardianId", "studentId");

-- CreateIndex
CREATE INDEX "StudentHistory_studentId_createdAt_idx" ON "StudentHistory"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_branchId_createdAt_idx" ON "ImportJob"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "Direction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_homeroomTeacherId_fkey" FOREIGN KEY ("homeroomTeacherId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentHistory" ADD CONSTRAINT "StudentHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentHistory" ADD CONSTRAINT "StudentHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One current academic year per branch.
CREATE UNIQUE INDEX "AcademicYear_one_current_per_branch" ON "AcademicYear"("branchId") WHERE "isCurrent";

-- One primary contact per student.
CREATE UNIQUE INDEX "GuardianLink_one_primary_per_student" ON "GuardianLink"("studentId") WHERE "isPrimary";

-- A global calendar entry (both branches) is unique per date and class type, NULLs included.
DROP INDEX "CalendarDay_branchId_date_classType_key";
CREATE UNIQUE INDEX "CalendarDay_branchId_date_classType_key" ON "CalendarDay"("branchId", "date", "classType") NULLS NOT DISTINCT;

-- Integrity rules the services also enforce.
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_dates" CHECK ("startDate" < "endDate");
ALTER TABLE "Term" ADD CONSTRAINT "Term_number" CHECK ("number" BETWEEN 1 AND 4);
ALTER TABLE "Term" ADD CONSTRAINT "Term_dates" CHECK ("startDate" <= "endDate");
ALTER TABLE "Class" ADD CONSTRAINT "Class_capacity_positive" CHECK ("capacity" > 0);
ALTER TABLE "Class" ADD CONSTRAINT "Class_grade_by_type" CHECK (
  ("type" = 'REGULAR' AND "gradeLevel" BETWEEN 1 AND 7 AND "directionId" IS NULL)
  OR ("type" = 'DIRECTION_GROUP' AND "gradeLevel" IS NULL AND "directionId" IS NOT NULL)
);
ALTER TABLE "Student" ADD CONSTRAINT "Student_gradeLevel" CHECK ("gradeLevel" BETWEEN 1 AND 11);
ALTER TABLE "Student" ADD CONSTRAINT "Student_number_format" CHECK ("number" ~ '^GL-[0-9]{6}$');
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_phone_format" CHECK ("phone" ~ '^\+998[0-9]{9}$');
