import { Prisma, type Db, type PrismaClient } from '@gl/db';
import type { z } from 'zod';
import { writeAudit, type ActorContext } from './audit';
import { DomainError, err, ok, type Result } from './result';

/**
 * Business rules with numbers (prices, discounts, deadlines, edit windows, thresholds) are
 * settings, not constants: they change without a release. Each setting is declared once with
 * its schema and default; the database stores only values that differ from the default.
 */
export interface SettingDefinition<T> {
  key: string;
  schema: z.ZodType<T>;
  defaultValue: T;
  /** `global` — one value for the whole school; `branch` — a branch may override it. */
  scope: 'global' | 'branch';
}

export function defineSetting<T>(definition: SettingDefinition<T>): SettingDefinition<T> {
  return definition;
}

export interface SettingScope {
  branchId?: string | null;
}

type StoredValues = Map<string, unknown>;

/**
 * Reads settings with a cache that lives as long as the reader. Create one reader per request
 * (the web app wraps it in React `cache`) — values never go stale across requests.
 * The first read for a branch loads the global and branch rows in one query.
 */
export function createSettingsReader(db: Db) {
  const loaded = new Map<string, Promise<{ global: StoredValues; branch: StoredValues }>>();

  function load(branchId: string | null) {
    const cacheKey = branchId ?? '';
    let pending = loaded.get(cacheKey);
    if (!pending) {
      pending = db.setting
        .findMany({
          where: { OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])] },
          select: { key: true, value: true, branchId: true },
        })
        .then((rows) => {
          const global: StoredValues = new Map();
          const branch: StoredValues = new Map();
          for (const row of rows) (row.branchId ? branch : global).set(row.key, row.value);
          return { global, branch };
        });
      loaded.set(cacheKey, pending);
    }
    return pending;
  }

  return {
    /** Branch value → global value → default. A stored value that fails its schema throws. */
    async get<T>(definition: SettingDefinition<T>, scope: SettingScope = {}): Promise<T> {
      const branchId = definition.scope === 'branch' ? (scope.branchId ?? null) : null;
      const { global, branch } = await load(branchId);
      const raw = branch.has(definition.key)
        ? branch.get(definition.key)
        : global.has(definition.key)
          ? global.get(definition.key)
          : undefined;
      if (raw === undefined) return definition.defaultValue;
      const parsed = definition.schema.safeParse(raw);
      if (!parsed.success) throw new DomainError('SETTING_INVALID', { key: definition.key });
      return parsed.data;
    },
  };
}

export type SettingsReader = ReturnType<typeof createSettingsReader>;

export interface UpdateSettingInput<T> extends SettingScope {
  value: T;
  actor: ActorContext;
  reason?: string | null;
}

const isRootClient = (db: Db): db is PrismaClient => '$transaction' in db;

/** Saves a setting value and its audit record in one transaction. */
export async function updateSetting<T>(
  db: Db,
  definition: SettingDefinition<T>,
  input: UpdateSettingInput<T>,
): Promise<Result<T>> {
  const branchId = input.branchId ?? null;
  if (definition.scope === 'global' && branchId) {
    return err('VALIDATION', undefined, { branchId: 'VALIDATION' });
  }
  const parsed = definition.schema.safeParse(input.value);
  if (!parsed.success) return err('SETTING_INVALID', { key: definition.key });
  const value = parsed.data as Prisma.InputJsonValue;

  const run = async (tx: Db) => {
    const existing = await tx.setting.findFirst({ where: { key: definition.key, branchId } });
    const saved = existing
      ? await tx.setting.update({
          where: { id: existing.id },
          data: { value, updatedById: input.actor.actorId },
        })
      : await tx.setting.create({
          data: { key: definition.key, branchId, value, updatedById: input.actor.actorId },
        });
    await writeAudit(tx, input.actor, {
      action: 'settings.setting.update',
      entityType: 'Setting',
      entityId: definition.key,
      branchId,
      before: existing ? { value: existing.value } : null,
      after: { value: saved.value },
      reason: input.reason ?? null,
    });
  };

  try {
    if (isRootClient(db)) await db.$transaction(run);
    else await run(db);
  } catch (error) {
    // Two concurrent first writes of the same key: the unique index rejects the second one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return err('CONFLICT');
    }
    throw error;
  }
  return ok(parsed.data);
}
