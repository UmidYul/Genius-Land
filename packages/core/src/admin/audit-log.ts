import type { Prisma } from '@gl/db';
import { requireScope } from '../access/scope';
import type { ServiceContext } from '../context';
import { startOfLocalDate, addDays, type LocalDate } from '../time';

export interface AuditFilters {
  /** Action prefix, e.g. `auth.` or `admin.user.` */
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  branchId?: string;
  /** Inclusive school-calendar dates. */
  from?: LocalDate;
  to?: LocalDate;
  page?: number;
}

const PAGE_SIZE = 50;

/** Audit trail, newest first, limited to what the actor may see (superadmin / founder). */
export async function listAuditLog(ctx: ServiceContext, filters: AuditFilters = {}) {
  const scope = requireScope(ctx.actor, 'admin.audit.view', { branch: 'branchId' });
  const page = Math.max(1, filters.page ?? 1);
  if (!scope) return { total: 0, page, pageSize: PAGE_SIZE, entries: [] };

  const where: Prisma.AuditLogWhereInput = {
    AND: [
      scope as Prisma.AuditLogWhereInput,
      {
        ...(filters.action && { action: { startsWith: filters.action } }),
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.entityId && { entityId: filters.entityId }),
        ...(filters.actorId && { actorId: filters.actorId }),
        ...(filters.branchId && { branchId: filters.branchId }),
        ...((filters.from || filters.to) && {
          createdAt: {
            ...(filters.from && { gte: startOfLocalDate(filters.from) }),
            ...(filters.to && { lt: startOfLocalDate(addDays(filters.to, 1)) }),
          },
        }),
      },
    ],
  };
  const [total, entries] = await Promise.all([
    ctx.db.auditLog.count({ where }),
    ctx.db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { id: true, fullName: true } } },
    }),
  ]);
  return { total, page, pageSize: PAGE_SIZE, entries };
}
