import type { PrismaClient } from '@gl/db';

/**
 * Branch-owned models and their branch column. Every later stage adds its models here
 * (classes, students, invoices, payments…). A test checks that each listed model exists.
 */
export const branchOwnedModels: Readonly<Record<string, string>> = {
  ApprovalRequest: 'branchId',
};

/** Operations that read or change many rows — they must carry a branch condition. */
const MULTI_ROW_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

/**
 * A where-clause restricts by branch if it names the branch column directly, or through AND
 * (any part), or through OR (every alternative). `{ branchId: undefined }` counts: it is how a
 * scope for "all branches" is written by `scopeWhere`.
 */
export function hasBranchCondition(where: unknown, field: string): boolean {
  if (!where || typeof where !== 'object') return false;
  const clause = where as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(clause, field)) return true;
  const and = clause.AND;
  if (
    Array.isArray(and)
      ? and.some((p) => hasBranchCondition(p, field))
      : hasBranchCondition(and, field)
  ) {
    return true;
  }
  const or = clause.OR;
  return Array.isArray(or) && or.length > 0 && or.every((p) => hasBranchCondition(p, field));
}

export class UnscopedQueryError extends Error {
  constructor(model: string, operation: string) {
    super(
      `${model}.${operation} without a branch condition. Use scopeWhere(actor, permission, …) ` +
        'or systemDb for deliberate system-wide queries.',
    );
    this.name = 'UnscopedQueryError';
  }
}

/**
 * Wraps a client so that multi-row queries of branch-owned models without a branch condition
 * throw. Services receive this client in their context, so forgetting the branch filter fails
 * loudly in tests instead of leaking another branch's data. Single-row lookups by id are allowed
 * — the service must then check `can(actor, permission, { branchId })` on the loaded record.
 *
 * The extension only intercepts queries and does not change the client's API, so the result is
 * typed as the plain client.
 */
export function guardBranchQueries(client: PrismaClient): PrismaClient {
  return client.$extends({
    name: 'gl-branch-guard',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const field = branchOwnedModels[model];
          if (field && MULTI_ROW_OPERATIONS.has(operation)) {
            const where = (args as { where?: unknown } | undefined)?.where;
            if (!hasBranchCondition(where, field)) throw new UnscopedQueryError(model, operation);
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}
