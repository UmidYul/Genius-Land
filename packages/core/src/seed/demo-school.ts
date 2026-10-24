import type { PrismaClient } from '@gl/db';
import { loadActor } from '../access/actor';
import { createServiceContext } from '../context';
import { addGuardian } from '../people/guardians';
import { createStaff } from '../people/staff';
import { createStudent } from '../people/students';
import { saveCatalogItem } from '../school/catalog';
import { addTeachingAssignment, createClass } from '../school/classes';
import { createAcademicYear } from '../school/years';

/**
 * A small demo school in the main branch, so the stage 2 screens have something to show.
 * Development only. Everything is marked "(демо)"; phones use the non-existent operator 00.
 * Created through the same services as real data, so every rule (capacity, grades) applies.
 * Skipped if the branch already has a current academic year.
 */
export async function seedDemoSchool(db: PrismaClient) {
  const branch = await db.branch.findUniqueOrThrow({ where: { code: 'main' } });
  if (await db.academicYear.findFirst({ where: { branchId: branch.id, isCurrent: true } }))
    return false;
  const director = await db.user.findUniqueOrThrow({ where: { phone: '+998000000003' } });
  const actor = await loadActor(db, director.id);
  if (!actor) throw new Error('demo director missing');
  const ctx = createServiceContext(db, actor);
  const must = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }): T => {
    if (!r.ok) throw new Error(`demo school: ${r.error.code}`);
    return r.value;
  };

  must(
    await createAcademicYear(ctx, {
      name: '2026–2027 (демо)',
      terms: [
        { startDate: '2026-09-02', endDate: '2026-10-31' },
        { startDate: '2026-11-09', endDate: '2026-12-28' },
        { startDate: '2027-01-12', endDate: '2027-03-19' },
        { startDate: '2027-03-29', endDate: '2027-05-25' },
      ],
      makeCurrent: true,
    }),
  );
  // The demo teacher account (+998000000006) becomes a staff member: ASSIGNED/HOMEROOM work.
  const teacher = must(
    await createStaff(ctx, {
      fullName: 'Учитель (демо)',
      phone: '+998000000006',
      position: 'Учитель (демо)',
    }),
  );
  const second = must(
    await createStaff(ctx, {
      fullName: 'Второй учитель (демо)',
      phone: '+998000000010',
      position: 'Учитель (демо)',
    }),
  );
  const subject = must(
    await saveCatalogItem(ctx, 'subject', { nameRu: 'Предмет (демо)', nameUz: 'Fan (demo)' }),
  );
  const economy = await db.direction.findUniqueOrThrow({ where: { nameRu: 'Экономика' } });

  const regular = must(
    await createClass(ctx, {
      type: 'REGULAR',
      name: '5-А',
      gradeLevel: 5,
      capacity: 25,
      homeroomTeacherId: teacher.id,
    }),
  );
  const group = must(
    await createClass(ctx, {
      type: 'DIRECTION_GROUP',
      name: 'ЭКОНОМИКА 1',
      directionId: economy.id,
      capacity: 20,
      homeroomTeacherId: second.id,
    }),
  );
  must(
    await addTeachingAssignment(ctx, {
      classId: group.id,
      subjectId: subject.id,
      staffId: teacher.id,
    }),
  );

  const students = [
    { firstName: 'Ученик 1', gradeLevel: 5, classId: regular.id, gender: 'MALE' as const },
    { firstName: 'Ученица 2', gradeLevel: 5, classId: regular.id, gender: 'FEMALE' as const },
    { firstName: 'Ученик 3', gradeLevel: 8, classId: group.id, gender: 'MALE' as const },
    { firstName: 'Ученица 4', gradeLevel: 10, classId: group.id, gender: 'FEMALE' as const },
  ];
  const created = [];
  for (const [i, s] of students.entries()) {
    created.push(
      must(
        await createStudent(ctx, {
          ...s,
          lastName: '(демо)',
          birthDate:
            s.gradeLevel === 5 ? `2015-0${i + 3}-10` : `201${s.gradeLevel === 8 ? 2 : 0}-04-1${i}`,
          confirmDuplicate: true,
        }),
      ),
    );
  }
  must(
    await addGuardian(ctx, {
      studentId: created[0]!.id,
      fullName: 'Родитель (демо)',
      phone: '+998000000008',
      relation: 'MOTHER',
    }),
  );
  return true;
}
