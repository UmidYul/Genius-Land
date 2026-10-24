import type { Db } from '@gl/db';
import type { ScopeRelations, ScopeRelationsProvider } from './actor';

/**
 * Real data behind the narrow scopes (stage 2):
 * - ASSIGNED — class × subject pairs from teaching assignments of the user's staff records;
 * - HOMEROOM — classes whose homeroom teacher is one of the user's staff records;
 * - CHILDREN — students linked to the user as guardian;
 * - SELF — the user's own student record.
 * Archived classes and staff give no access.
 */
export const dbScopeRelationsProvider: ScopeRelationsProvider = {
  async load(db: Db, userId: string): Promise<ScopeRelations> {
    const [teaching, homeroom, children, self] = await Promise.all([
      db.teachingAssignment.findMany({
        where: {
          branchId: undefined,
          staff: { userId, archivedAt: null },
          class: { archivedAt: null },
        },
        select: { classId: true, subjectId: true },
      }),
      db.class.findMany({
        where: {
          branchId: undefined,
          archivedAt: null,
          homeroomTeacher: { userId, archivedAt: null },
        },
        select: { id: true },
      }),
      db.guardianLink.findMany({ where: { guardianId: userId }, select: { studentId: true } }),
      db.student.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    return {
      teaching: teaching.map((t) => ({ classId: t.classId, subjectId: t.subjectId })),
      homeroomClassIds: homeroom.map((c) => c.id),
      childStudentIds: children.map((c) => c.studentId),
      selfStudentId: self?.id ?? null,
    };
  },
};
