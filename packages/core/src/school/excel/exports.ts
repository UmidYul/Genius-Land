import { translate, type Locale, type MessageKey } from '@gl/i18n';
import { formatPhone } from '../../auth/phone';
import type { ServiceContext } from '../../context';
import { listGuardians } from '../../people/guardians';
import { listStaff } from '../../people/staff';
import { listStudents, type StudentFilters } from '../../people/students';
import { formatDate } from '../../time';
import { listClasses, type ClassFilters } from '../classes';
import { fromDbDate } from '../dates';
import { buildExport } from './workbook';

/**
 * Registry exports. Each uses the same list function as the page, so filters and permissions
 * are identical: an export never contains a row the user cannot see on screen.
 */
export type ExportKind = 'classes' | 'staff' | 'students' | 'guardians';

const t = (locale: Locale, key: string, params?: Record<string, string | number>) =>
  translate(locale, key as MessageKey, params);
const branchName = (locale: Locale, b: { nameUz: string; nameRu: string }) =>
  locale === 'ru' ? b.nameRu : b.nameUz;

export async function exportRegistry(
  ctx: ServiceContext,
  kind: ExportKind,
  locale: Locale,
  filters: Record<string, string | undefined>,
): Promise<{ fileName: string; data: Buffer }> {
  const h = (key: string) => t(locale, `export.columns.${kind}.${key}`);
  const sheet = t(locale, `export.sheets.${kind}`);
  const stamp = new Date().toISOString().slice(0, 10);
  const file = (name: string) => ({ fileName: `${name}-${stamp}.xlsx` });

  if (kind === 'classes') {
    const rows = await listClasses(ctx, {
      query: filters.q,
      type: (filters.type as ClassFilters['type']) || undefined,
      gradeLevel: Number(filters.grade) || undefined,
      academicYearId: filters.year || undefined,
      includeArchived: filters.archived === '1',
    });
    return {
      ...file('classes'),
      data: await buildExport(
        sheet,
        [
          { header: h('name'), value: (c) => c.name },
          { header: h('type'), value: (c) => t(locale, `import.values.classType.${c.type}`) },
          { header: h('grade'), value: (c) => c.gradeLevel },
          {
            header: h('direction'),
            value: (c) => (c.direction ? branchName(locale, c.direction) : ''),
          },
          { header: h('occupied'), value: (c) => c.occupied },
          { header: h('capacity'), value: (c) => c.capacity },
          { header: h('homeroom'), value: (c) => c.homeroomTeacher.fullName },
          { header: h('year'), value: (c) => c.academicYear.name },
          { header: h('branch'), value: (c) => branchName(locale, c.branch) },
        ],
        rows,
      ),
    };
  }

  if (kind === 'staff') {
    const { staff } = await listStaff(ctx, {
      query: filters.q,
      includeArchived: filters.archived === '1',
      all: true,
    });
    return {
      ...file('staff'),
      data: await buildExport(
        sheet,
        [
          { header: h('fullName'), width: 32, value: (s) => s.fullName },
          { header: h('phone'), value: (s) => formatPhone(s.phone) },
          { header: h('position'), value: (s) => s.position },
          { header: h('homeroom'), value: (s) => s.homeroomClasses.map((c) => c.name).join(', ') },
          {
            header: h('account'),
            value: (s) =>
              t(locale, s.userId ? 'import.values.yesNo.yes' : 'import.values.yesNo.no'),
          },
          { header: h('branch'), value: (s) => branchName(locale, s.branch) },
        ],
        staff,
      ),
    };
  }

  if (kind === 'students') {
    const { students } = await listStudents(ctx, {
      query: filters.q,
      classId: filters.class || undefined,
      gradeLevel: Number(filters.grade) || undefined,
      status: (filters.status as StudentFilters['status']) || undefined,
      all: true,
    });
    return {
      ...file('students'),
      data: await buildExport(
        sheet,
        [
          { header: h('number'), value: (s) => s.number },
          { header: h('lastName'), value: (s) => s.lastName },
          { header: h('firstName'), value: (s) => s.firstName },
          { header: h('middleName'), value: (s) => s.middleName ?? '' },
          { header: h('birthDate'), value: (s) => formatDate(fromDbDate(s.birthDate)) },
          { header: h('gender'), value: (s) => t(locale, `import.values.gender.${s.gender}`) },
          { header: h('grade'), value: (s) => s.gradeLevel },
          { header: h('class'), value: (s) => s.class?.name ?? '' },
          { header: h('status'), value: (s) => t(locale, `people.students.status.${s.status}`) },
          {
            header: h('primaryGuardian'),
            width: 36,
            value: (s) => {
              const g = s.guardians[0]?.guardian;
              return g ? `${g.fullName}, ${formatPhone(g.phone)}` : '';
            },
          },
          { header: h('branch'), value: (s) => branchName(locale, s.branch) },
        ],
        students,
      ),
    };
  }

  const { guardians } = await listGuardians(ctx, { query: filters.q, all: true });
  return {
    ...file('guardians'),
    data: await buildExport(
      sheet,
      [
        { header: h('fullName'), width: 32, value: (g) => g.fullName },
        { header: h('phone'), value: (g) => formatPhone(g.phone) },
        {
          header: h('children'),
          width: 60,
          value: (g) =>
            g.guardianLinks
              .map(
                (l) =>
                  `${l.student.number} ${l.student.lastName} ${l.student.firstName}${l.student.class ? ` (${l.student.class.name})` : ''}`,
              )
              .join('; '),
        },
      ],
      guardians,
    ),
  };
}
