import { prisma } from '@gl/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { can } from '../access/can';
import { loadActor } from '../access/actor';
import { addGuardian, listGuardians } from '../people/guardians';
import { createStaff, listStaff } from '../people/staff';
import {
  changeStudentStatus,
  createStudent,
  getStudent,
  listStudents,
  transferStudent,
  type StudentInput,
} from '../people/students';
import type { ServiceContext } from '../context';
import { contextFor, createUser, setupWorld, type TestWorld } from '../testing/fixtures';
import { addCalendarDay, isSchoolDay } from './calendar';
import { saveCatalogItem } from './catalog';
import {
  addTeachingAssignment,
  createClass,
  getClass,
  listClasses,
  setClassArchived,
  updateClass,
} from './classes';
import { createAcademicYear } from './years';

let world: TestWorld;

const TERMS = [
  { startDate: '2026-09-02', endDate: '2026-10-31' },
  { startDate: '2026-11-09', endDate: '2026-12-28' },
  { startDate: '2027-01-12', endDate: '2027-03-19' },
  { startDate: '2027-03-29', endDate: '2027-05-25' },
];

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};

/** A director's context with a current year, a teacher and a direction in the branch. */
async function branchSetup(branchId: string, phoneSuffix: string) {
  const director = await createUser({ roles: [{ role: 'DIRECTOR', branchIds: [branchId] }] });
  const ctx = await contextFor(director.id);
  unwrap(await createAcademicYear(ctx, { name: '2026–2027', terms: TERMS, makeCurrent: true }));
  const teacherUser = await createUser({
    roles: [{ role: 'TEACHER', branchIds: [branchId] }],
    phone: `+99800${phoneSuffix}00001`,
  });
  const teacher = unwrap(
    await createStaff(ctx, { fullName: 'Teacher', phone: teacherUser.phone, position: 'teacher' }),
  );
  return { ctx, teacherUserId: teacherUser.id, teacherId: teacher.id };
}

const student = (over: Partial<StudentInput> = {}): StudentInput => ({
  lastName: 'Test',
  firstName: `S${Math.random().toString(36).slice(2, 8)}`,
  birthDate: '2015-03-04',
  gender: 'MALE',
  gradeLevel: 5,
  ...over,
});

let a: Awaited<ReturnType<typeof branchSetup>>;
let directionId: string;

beforeEach(async () => {
  world = await setupWorld();
  a = await branchSetup(world.branchA, '11');
  directionId = unwrap(
    await saveCatalogItem(a.ctx, 'direction', { nameRu: 'Экономика', nameUz: 'Iqtisodiyot' }),
  ).id;
});

async function regularClass(
  ctx: ServiceContext,
  homeroomTeacherId: string,
  capacity = 30,
  name = '5-А',
) {
  return unwrap(
    await createClass(ctx, { type: 'REGULAR', name, gradeLevel: 5, capacity, homeroomTeacherId }),
  ).id;
}

describe('classes', () => {
  it('names are unique per branch and year, ignoring case and spaces', async () => {
    await regularClass(a.ctx, a.teacherId);
    expect(
      await createClass(a.ctx, {
        type: 'REGULAR',
        name: ' 5 - а',
        gradeLevel: 5,
        capacity: 20,
        homeroomTeacherId: a.teacherId,
      }),
    ).toMatchObject({ error: { code: 'CLASS_NAME_TAKEN' } });
  });

  it('a group needs a direction; a class needs a grade 1–7', async () => {
    expect(
      await createClass(a.ctx, {
        type: 'DIRECTION_GROUP',
        name: 'ЭКОНОМИКА 1',
        capacity: 20,
        homeroomTeacherId: a.teacherId,
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', fields: { directionId: 'CLASS_DIRECTION_REQUIRED' } },
    });
    expect(
      await createClass(a.ctx, {
        type: 'REGULAR',
        name: '8-А',
        gradeLevel: 8,
        capacity: 20,
        homeroomTeacherId: a.teacherId,
      }),
    ).toMatchObject({ ok: false });
    expect(
      (
        await createClass(a.ctx, {
          type: 'DIRECTION_GROUP',
          name: 'ЭКОНОМИКА 1',
          directionId,
          capacity: 20,
          homeroomTeacherId: a.teacherId,
        })
      ).ok,
    ).toBe(true);
  });

  it('capacity cannot drop below occupancy; a class with students cannot be archived', async () => {
    const classId = await regularClass(a.ctx, a.teacherId, 2);
    unwrap(await createStudent(a.ctx, student({ classId })));
    unwrap(await createStudent(a.ctx, student({ classId })));
    expect(
      await updateClass(a.ctx, classId, {
        name: '5-А',
        gradeLevel: 5,
        capacity: 1,
        homeroomTeacherId: a.teacherId,
      }),
    ).toMatchObject({ error: { code: 'CLASS_CAPACITY_BELOW_OCCUPANCY' } });
    expect(await setClassArchived(a.ctx, classId, true)).toMatchObject({
      error: { code: 'CLASS_HAS_STUDENTS', params: { count: 2 } },
    });
    const list = await listClasses(a.ctx);
    expect(list.find((c) => c.id === classId)).toMatchObject({ occupied: 2, capacity: 2 });
  });
});

describe('students', () => {
  it('numbers are GL- + 6 digits, school-wide and increasing', async () => {
    const first = unwrap(await createStudent(a.ctx, student()));
    const second = unwrap(await createStudent(a.ctx, student()));
    expect(first.number).toMatch(/^GL-\d{6}$/);
    expect(Number(second.number.slice(3))).toBe(Number(first.number.slice(3)) + 1);
  });

  it('capacity is never exceeded, even by simultaneous enrolments', async () => {
    const classId = await regularClass(a.ctx, a.teacherId, 1);
    const results = await Promise.all([
      createStudent(a.ctx, student({ classId })),
      createStudent(a.ctx, student({ classId })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: { code: 'CLASS_FULL' } });
    expect(await prisma.student.count({ where: { classId } })).toBe(1);
  });

  it('grade must match a class 1–7; groups take 8–11 of mixed grades', async () => {
    const classId = await regularClass(a.ctx, a.teacherId);
    expect(await createStudent(a.ctx, student({ classId, gradeLevel: 6 }))).toMatchObject({
      error: { code: 'CLASS_GRADE_MISMATCH' },
    });
    const groupId = unwrap(
      await createClass(a.ctx, {
        type: 'DIRECTION_GROUP',
        name: 'ЭКОНОМИКА 1',
        directionId,
        capacity: 20,
        homeroomTeacherId: a.teacherId,
      }),
    ).id;
    expect(await createStudent(a.ctx, student({ classId: groupId, gradeLevel: 7 }))).toMatchObject({
      error: { code: 'GROUP_GRADE_INVALID' },
    });
    for (const gradeLevel of [8, 10, 11]) {
      expect((await createStudent(a.ctx, student({ classId: groupId, gradeLevel }))).ok).toBe(true);
    }
    const group = await getClass(a.ctx, groupId);
    expect(group!.students.map((s) => s.gradeLevel).sort()).toEqual([10, 11, 8]);
  });

  it('birth date cannot be in the future', async () => {
    expect(await createStudent(a.ctx, student({ birthDate: '2999-01-01' }))).toMatchObject({
      error: { code: 'BIRTHDATE_INVALID' },
    });
  });

  it('warns about a possible duplicate and saves after confirmation', async () => {
    unwrap(await createStudent(a.ctx, student({ firstName: 'Same' })));
    expect(await createStudent(a.ctx, student({ firstName: 'same' }))).toMatchObject({
      error: { code: 'STUDENT_POSSIBLE_DUPLICATE' },
    });
    expect(
      (await createStudent(a.ctx, student({ firstName: 'Same', confirmDuplicate: true }))).ok,
    ).toBe(true);
  });

  it("a duplicate in another branch is reported without that branch's numbers", async () => {
    const b = await branchSetup(world.branchB, '22');
    unwrap(await createStudent(b.ctx, student({ firstName: 'Twin' })));
    const result = await createStudent(a.ctx, student({ firstName: 'Twin' }));
    expect(result).toMatchObject({ error: { code: 'STUDENT_POSSIBLE_DUPLICATE_OTHER_BRANCH' } });
    expect(JSON.stringify(result)).not.toContain('GL-');
  });

  it('transfer and status changes keep history and audit', async () => {
    const from = await regularClass(a.ctx, a.teacherId, 30, '5-А');
    const to = await regularClass(a.ctx, a.teacherId, 30, '5-Б');
    const { id } = unwrap(await createStudent(a.ctx, student({ classId: from })));
    unwrap(await transferStudent(a.ctx, { studentId: id, toClassId: to, reason: 'parents' }));
    expect(
      await changeStudentStatus(a.ctx, { studentId: id, status: 'LEFT', reason: '' }),
    ).toMatchObject({
      error: { code: 'REASON_REQUIRED' },
    });
    unwrap(await changeStudentStatus(a.ctx, { studentId: id, status: 'LEFT', reason: 'moved' }));
    const card = await getStudent(a.ctx, id);
    expect(card!.history.map((h) => h.kind)).toEqual(['STATUS', 'TRANSFER', 'ENROLLED']);
    expect(card!.classId).toBe(to);
    expect(
      await prisma.auditLog.count({
        where: { entityId: id, action: { startsWith: 'people.student.' } },
      }),
    ).toBe(3);
    // A student who left no longer takes a seat.
    expect((await listClasses(a.ctx)).find((c) => c.id === to)?.occupied).toBe(0);
  });
});

describe('scopes on real data', () => {
  it('ASSIGNED and HOMEROOM come from teaching assignments and homeroom classes', async () => {
    const homeroom = await regularClass(a.ctx, a.teacherId, 30, '5-А');
    const otherStaff = unwrap(
      await createStaff(a.ctx, { fullName: 'Other', phone: '+998001100002', position: 'teacher' }),
    );
    const taught = await regularClass(a.ctx, otherStaff.id, 30, '5-Б');
    const foreign = await regularClass(a.ctx, otherStaff.id, 30, '5-В');
    const subjectId = unwrap(
      await saveCatalogItem(a.ctx, 'subject', { nameRu: 'Математика', nameUz: 'Matematika' }),
    ).id;
    unwrap(
      await addTeachingAssignment(a.ctx, { classId: taught, subjectId, staffId: a.teacherId }),
    );
    for (const classId of [homeroom, taught, foreign])
      unwrap(await createStudent(a.ctx, student({ classId })));

    const teacher = (await loadActor(prisma, a.teacherUserId))!;
    expect(teacher.relations.homeroomClassIds).toEqual([homeroom]);
    expect(teacher.relations.teaching).toEqual([{ classId: taught, subjectId }]);
    expect(
      can(teacher, 'journal.grade.write', { branchId: world.branchA, classId: taught, subjectId }),
    ).toBe(true);
    expect(
      can(teacher, 'journal.grade.write', {
        branchId: world.branchA,
        classId: homeroom,
        subjectId,
      }),
    ).toBe(false);
    expect(
      can(teacher, 'notifications.broadcast.send', { branchId: world.branchA, classId: homeroom }),
    ).toBe(true);
    expect(
      can(teacher, 'notifications.broadcast.send', { branchId: world.branchA, classId: taught }),
    ).toBe(false);

    // The teacher sees students of taught and homeroom classes only.
    const ctx = await contextFor(a.teacherUserId);
    const { students } = await listStudents(ctx);
    expect(new Set(students.map((s) => s.classId))).toEqual(new Set([homeroom, taught]));
    expect((await listClasses(ctx)).map((c) => c.id).sort()).toEqual([homeroom, taught].sort());
  });

  it('CHILDREN: a parent is linked to their children only', async () => {
    const classId = await regularClass(a.ctx, a.teacherId);
    const kid1 = unwrap(await createStudent(a.ctx, student({ classId }))).id;
    const kid2 = unwrap(await createStudent(a.ctx, student({ classId }))).id;
    const other = unwrap(await createStudent(a.ctx, student({ classId }))).id;
    const first = unwrap(
      await addGuardian(a.ctx, {
        studentId: kid1,
        fullName: 'Parent',
        phone: '+998001199001',
        relation: 'MOTHER',
      }),
    );
    const again = unwrap(
      await addGuardian(a.ctx, {
        studentId: kid2,
        fullName: 'Parent',
        phone: '998001199001',
        relation: 'MOTHER',
      }),
    );
    expect(first.created).toBe(true);
    expect(again).toEqual({ guardianId: first.guardianId, created: false });
    const parentUser = await prisma.user.findUniqueOrThrow({ where: { id: first.guardianId } });
    expect(parentUser.passwordHash).toBeNull();

    const parent = (await loadActor(prisma, first.guardianId))!;
    expect(parent.roleCodes).toEqual(['PARENT']);
    expect([...parent.relations.childStudentIds].sort()).toEqual([kid1, kid2].sort());
    expect(can(parent, 'journal.grade.view', { studentId: kid1 })).toBe(true);
    expect(can(parent, 'journal.grade.view', { studentId: other })).toBe(false);

    // First guardian of a student becomes the primary contact; only one primary per student.
    await addGuardian(a.ctx, {
      studentId: kid1,
      fullName: 'Dad',
      phone: '+998001199002',
      relation: 'FATHER',
      isPrimary: true,
    });
    const links = await prisma.guardianLink.findMany({ where: { studentId: kid1 } });
    expect(links.filter((l) => l.isPrimary)).toHaveLength(1);
  });
});

describe('branch isolation', () => {
  it('director, administrator and teacher of A see nothing of branch B', async () => {
    const b = await branchSetup(world.branchB, '22');
    const classB = await regularClass(b.ctx, b.teacherId);
    const studentB = unwrap(await createStudent(b.ctx, student({ classId: classB }))).id;
    await addGuardian(b.ctx, {
      studentId: studentB,
      fullName: 'Parent B',
      phone: '+998002299001',
      relation: 'MOTHER',
    });

    const admin = await createUser({
      roles: [{ role: 'ADMINISTRATOR', branchIds: [world.branchA] }],
    });
    for (const ctx of [a.ctx, await contextFor(admin.id), await contextFor(a.teacherUserId)]) {
      expect((await listClasses(ctx)).map((c) => c.branchId)).not.toContain(world.branchB);
      expect((await listStudents(ctx)).students.map((s) => s.id)).not.toContain(studentB);
      expect(await getStudent(ctx, studentB)).toBeNull();
      expect(await getClass(ctx, classB)).toBeNull();
      if (can(ctx.actor, 'people.guardian.view')) {
        expect((await listGuardians(ctx)).guardians.map((g) => g.fullName)).not.toContain(
          'Parent B',
        );
      }
      if (can(ctx.actor, 'people.staff.view')) {
        expect((await listStaff(ctx)).staff.map((s) => s.branchId)).not.toContain(world.branchB);
      }
    }
    // Writes into the other branch are refused.
    expect(await transferStudent(a.ctx, { studentId: studentB, toClassId: classB })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(
      await updateClass(a.ctx, classB, {
        name: 'X',
        gradeLevel: 5,
        capacity: 10,
        homeroomTeacherId: a.teacherId,
      }),
    ).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(await createStudent(a.ctx, student({ classId: classB }))).toMatchObject({ ok: false });
    expect(
      await createStaff(a.ctx, {
        fullName: 'Foreign Staff',
        phone: '+998001100099',
        position: 'x',
        branchId: world.branchB,
      }),
    ).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });

  it('the founder sees both branches; the accountant sees students of assigned branches', async () => {
    const b = await branchSetup(world.branchB, '22');
    unwrap(await createStudent(a.ctx, student()));
    unwrap(await createStudent(b.ctx, student()));
    const founder = await createUser({ roles: [{ role: 'FOUNDER' }] });
    expect((await listStudents(await contextFor(founder.id))).total).toBe(2);
    const accountant = await createUser({
      roles: [{ role: 'ACCOUNTANT', branchIds: [world.branchB] }],
    });
    const ctx = await contextFor(accountant.id);
    const { students } = await listStudents(ctx);
    expect(students.map((s) => s.branchId)).toEqual([world.branchB]);
    // View only.
    await expect(createStudent(ctx, student())).resolves.toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });
});

describe('calendar on real data', () => {
  it('isSchoolDay reads terms and holidays of the class branch', async () => {
    const classId = await regularClass(a.ctx, a.teacherId);
    const groupId = unwrap(
      await createClass(a.ctx, {
        type: 'DIRECTION_GROUP',
        name: 'ЭКОНОМИКА 1',
        directionId,
        capacity: 20,
        homeroomTeacherId: a.teacherId,
      }),
    ).id;
    const saturday = { year: 2026, month: 9, day: 5 };
    const wednesday = { year: 2026, month: 9, day: 9 };
    expect(await isSchoolDay(prisma, classId, saturday)).toBe(false);
    expect(await isSchoolDay(prisma, groupId, saturday)).toBe(true);
    expect(await isSchoolDay(prisma, classId, wednesday)).toBe(true);
    unwrap(
      await addCalendarDay(a.ctx, { date: '2026-09-09', kind: 'HOLIDAY', branchId: world.branchA }),
    );
    expect(await isSchoolDay(prisma, classId, wednesday)).toBe(false);
    expect(await isSchoolDay(prisma, classId, { year: 2026, month: 11, day: 4 })).toBe(false); // autumn break
  });

  it('a director cannot add a day for both branches or for the other branch', async () => {
    expect(
      await addCalendarDay(a.ctx, { date: '2026-09-10', kind: 'HOLIDAY', branchId: null }),
    ).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
    await expect(
      addCalendarDay(a.ctx, { date: '2026-09-10', kind: 'HOLIDAY', branchId: world.branchB }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
