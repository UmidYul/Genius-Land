import { z } from 'zod';
import { assertCan } from '../access/can';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';

export const branchInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,39}$/),
  nameUz: z.string().trim().min(1).max(120),
  nameRu: z.string().trim().min(1).max(120),
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});
export type BranchInput = z.input<typeof branchInput>;

const fieldErrors = (error: z.ZodError) =>
  Object.fromEntries(error.issues.map((i) => [i.path.join('.'), 'VALIDATION' as const]));

export function listBranches(ctx: ServiceContext) {
  assertCan(ctx.actor, 'admin.branch.view');
  return ctx.db.branch.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function createBranch(
  ctx: ServiceContext,
  input: BranchInput,
): Promise<Result<{ id: string }>> {
  assertCan(ctx.actor, 'admin.branch.manage');
  const parsed = branchInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, fieldErrors(parsed.error));
  if (await ctx.db.branch.findUnique({ where: { code: parsed.data.code } })) {
    return err('BRANCH_CODE_TAKEN', undefined, { code: 'BRANCH_CODE_TAKEN' });
  }
  const branch = await ctx.db.$transaction(async (tx) => {
    const created = await tx.branch.create({ data: parsed.data });
    await writeAudit(tx, auditActor(ctx), {
      action: 'admin.branch.create',
      entityType: 'Branch',
      entityId: created.id,
      branchId: created.id,
      after: parsed.data,
    });
    return created;
  });
  return ok({ id: branch.id });
}

/** Renames a branch or changes its address. The code stays: it identifies the branch. */
export async function updateBranch(
  ctx: ServiceContext,
  id: string,
  input: Omit<BranchInput, 'code'>,
): Promise<Result<{ id: string }>> {
  assertCan(ctx.actor, 'admin.branch.manage');
  const parsed = branchInput.omit({ code: true }).safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, fieldErrors(parsed.error));
  const before = await ctx.db.branch.findUnique({ where: { id } });
  if (!before) return err('NOT_FOUND');
  await ctx.db.$transaction(async (tx) => {
    await tx.branch.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, auditActor(ctx), {
      action: 'admin.branch.update',
      entityType: 'Branch',
      entityId: id,
      branchId: id,
      before: { nameUz: before.nameUz, nameRu: before.nameRu, address: before.address },
      after: parsed.data,
    });
  });
  return ok({ id });
}
