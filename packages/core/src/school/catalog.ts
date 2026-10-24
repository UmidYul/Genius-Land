import { z } from 'zod';
import { assertCan } from '../access/can';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';

/**
 * School-wide reference lists: subjects and directions (Экономика, Медицина, Филология…).
 * Shared by both branches; anyone who manages subjects in a branch may edit them.
 */
export type CatalogKind = 'subject' | 'direction';

export const catalogInput = z.object({
  nameUz: z.string().trim().min(1).max(120),
  nameRu: z.string().trim().min(1).max(120),
});

const delegate = (ctx: ServiceContext, kind: CatalogKind) =>
  (kind === 'subject' ? ctx.db.subject : ctx.db.direction) as unknown as {
    findMany: (
      args: object,
    ) => Promise<{ id: string; nameUz: string; nameRu: string; archivedAt: Date | null }[]>;
    findFirst: (args: object) => Promise<{ id: string } | null>;
    findUnique: (
      args: object,
    ) => Promise<{ id: string; nameUz: string; nameRu: string; archivedAt: Date | null } | null>;
  };

const entity = (kind: CatalogKind) => (kind === 'subject' ? 'Subject' : 'Direction');
const takenCode = (kind: CatalogKind) =>
  kind === 'subject' ? ('SUBJECT_NAME_TAKEN' as const) : ('DIRECTION_NAME_TAKEN' as const);

export function listCatalog(ctx: ServiceContext, kind: CatalogKind, includeArchived = false) {
  assertCan(ctx.actor, 'school.subject.view');
  return delegate(ctx, kind).findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { nameRu: 'asc' },
  });
}

export async function saveCatalogItem(
  ctx: ServiceContext,
  kind: CatalogKind,
  input: z.input<typeof catalogInput>,
  id?: string,
): Promise<Result<{ id: string }>> {
  assertCan(ctx.actor, 'school.subject.manage');
  const parsed = catalogInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, { nameRu: 'VALIDATION' });
  const clash = await delegate(ctx, kind).findFirst({
    where: {
      nameRu: { equals: parsed.data.nameRu, mode: 'insensitive' },
      ...(id && { id: { not: id } }),
    },
  });
  if (clash) return err(takenCode(kind), undefined, { nameRu: takenCode(kind) });

  const before = id ? await delegate(ctx, kind).findUnique({ where: { id } }) : null;
  if (id && !before) return err('NOT_FOUND');
  const saved = await ctx.db.$transaction(async (tx) => {
    const model = (kind === 'subject' ? tx.subject : tx.direction) as unknown as {
      create: (a: object) => Promise<{ id: string }>;
      update: (a: object) => Promise<{ id: string }>;
    };
    const row = id
      ? await model.update({ where: { id }, data: parsed.data })
      : await model.create({ data: parsed.data });
    await writeAudit(tx, auditActor(ctx), {
      action: `school.${kind}.${id ? 'update' : 'create'}`,
      entityType: entity(kind),
      entityId: row.id,
      before: before ? { nameUz: before.nameUz, nameRu: before.nameRu } : null,
      after: parsed.data,
    });
    return row;
  });
  return ok({ id: saved.id });
}

/** Archived items disappear from pickers; existing classes and assignments keep them. */
export async function setCatalogArchived(
  ctx: ServiceContext,
  kind: CatalogKind,
  id: string,
  archived: boolean,
): Promise<Result<true>> {
  assertCan(ctx.actor, 'school.subject.manage');
  const item = await delegate(ctx, kind).findUnique({ where: { id } });
  if (!item) return err('NOT_FOUND');
  await ctx.db.$transaction(async (tx) => {
    const model = (kind === 'subject' ? tx.subject : tx.direction) as unknown as {
      update: (a: object) => Promise<unknown>;
    };
    await model.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await writeAudit(tx, auditActor(ctx), {
      action: `school.${kind}.${archived ? 'archive' : 'restore'}`,
      entityType: entity(kind),
      entityId: id,
    });
  });
  return ok(true);
}
