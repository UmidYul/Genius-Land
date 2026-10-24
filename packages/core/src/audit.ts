import { Prisma, type Db } from '@gl/db';

/** Who did the action and from where. `actorId: null` means the system itself. */
export interface ActorContext {
  actorId: string | null;
  ip?: string | null;
}

export interface AuditEntry {
  /** Dotted action code, the same shape as permissions: `settings.setting.update`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Converts values that JSON cannot hold: BigInt (money) → string, Date → ISO string. */
export function toAuditJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toAuditJson);
  if (typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = toAuditJson(item);
    }
    return out;
  }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

const jsonOrNull = (value: unknown) =>
  value === undefined || value === null
    ? Prisma.DbNull
    : (toAuditJson(value) as Prisma.InputJsonValue);

/**
 * Appends an audit record. Call it inside the same transaction as the change it describes,
 * so a change is never saved without its record (and vice versa).
 */
export async function writeAudit(db: Db, actor: ActorContext, entry: AuditEntry) {
  return db.auditLog.create({
    data: {
      actorId: actor.actorId,
      ip: actor.ip ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      branchId: entry.branchId ?? null,
      before: jsonOrNull(entry.before),
      after: jsonOrNull(entry.after),
      reason: entry.reason ?? null,
    },
  });
}
