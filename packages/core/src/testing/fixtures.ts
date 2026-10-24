/**
 * Test helpers (not exported from the package index). Integration tests run against
 * DATABASE_URL_TEST, one file at a time.
 */
import { prisma, type PrismaClient } from '@gl/db';
import { randomUUID } from 'node:crypto';
import type { Actor, Grant, ScopeRelations } from '../access/actor';
import { emptyScopeRelations, loadActor } from '../access/actor';
import type { PermissionCode } from '../access/permissions';
import { roleDefinitions, type RoleCode } from '../access/roles';
import { syncAccessModel } from '../access/sync';
import { hashPassword } from '../auth/password';
import { createServiceContext, type ServiceContext } from '../context';
import type {
  ChannelProvider,
  NotificationDispatcher,
  OutgoingMessage,
} from '../notifications/dispatcher';
import { createDispatcher } from '../notifications/dispatcher';
import { createSettingsReader } from '../settings';

export const TEST_PASSWORD = 'secret123';

/** Empties every table (migrations stay). TRUNCATE bypasses the audit log's row triggers. */
export async function resetDatabase(db: PrismaClient = prisma) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export interface TestWorld {
  branchA: string;
  branchB: string;
}

/** Access model + two branches. */
export async function setupWorld(db: PrismaClient = prisma): Promise<TestWorld> {
  await resetDatabase(db);
  await syncAccessModel(db);
  const a = await db.branch.create({ data: { code: 'a', nameUz: 'A', nameRu: 'A' } });
  const b = await db.branch.create({ data: { code: 'b', nameUz: 'B', nameRu: 'B' } });
  return { branchA: a.id, branchB: b.id };
}

let phoneCounter = 100;
export const nextPhone = () => `+99800${String(phoneCounter++).padStart(7, '0')}`;

let passwordHash: Promise<string> | undefined;

export async function createUser(
  input: {
    roles?: { role: RoleCode; branchIds?: string[] }[];
    email?: string;
    password?: string | null;
    phone?: string;
    fullName?: string;
  } = {},
  db: PrismaClient = prisma,
) {
  passwordHash ??= hashPassword(TEST_PASSWORD);
  const phone = input.phone ?? nextPhone();
  const user = await db.user.create({
    data: {
      phone,
      fullName: input.fullName ?? `Test ${phone}`,
      email: input.email ?? null,
      passwordHash:
        input.password === null
          ? null
          : input.password
            ? await hashPassword(input.password)
            : await passwordHash,
      channels: {
        create: [
          { type: 'SMS', address: phone, verifiedAt: new Date() },
          ...(input.email
            ? [{ type: 'EMAIL' as const, address: input.email, verifiedAt: new Date() }]
            : []),
        ],
      },
    },
  });
  for (const r of input.roles ?? []) {
    const role = await db.role.findUniqueOrThrow({ where: { code: r.role } });
    await db.roleAssignment.create({
      data: {
        userId: user.id,
        roleId: role.id,
        branches: { create: (r.branchIds ?? []).map((branchId) => ({ branchId })) },
      },
    });
  }
  return user;
}

export async function contextFor(
  userId: string,
  db: PrismaClient = prisma,
): Promise<ServiceContext> {
  const actor = await loadActor(db, userId);
  if (!actor) throw new Error('actor not loadable');
  return createServiceContext(db, actor, '127.0.0.1');
}

/** Builds an actor straight from the role definitions — no database (unit tests). */
export function actorFromDefinitions(
  assignments: { role: RoleCode; branchIds: string[] }[],
  options: {
    allBranchIds: string[];
    relations?: Partial<ScopeRelations>;
    activeBranchId?: string | null;
    userId?: string;
  },
): Actor {
  const grants = new Map<PermissionCode, Grant[]>();
  let hasAllBranches = false;
  let maxRank = 0;
  for (const a of assignments) {
    const def = roleDefinitions[a.role];
    maxRank = Math.max(maxRank, def.rank);
    for (const [code, scope] of Object.entries(def.grants)) {
      if (scope === 'ALL_BRANCHES' || scope === 'SYSTEM') hasAllBranches = true;
      const list = grants.get(code as PermissionCode) ?? [];
      list.push({ scope, branchIds: a.branchIds });
      grants.set(code as PermissionCode, list);
    }
  }
  const visible = hasAllBranches
    ? options.allBranchIds
    : [...new Set(assignments.flatMap((a) => a.branchIds))];
  return {
    userId: options.userId ?? randomUUID(),
    fullName: 'Test',
    roleCodes: assignments.map((a) => a.role),
    maxRank,
    grants,
    branches: visible.map((id) => ({ id, nameUz: id, nameRu: id })),
    hasAllBranches,
    activeBranchId: options.activeBranchId ?? null,
    relations: { ...emptyScopeRelations, ...options.relations },
  };
}

/** Dispatcher whose providers record messages instead of sending them. */
export function recordingDispatcher(): NotificationDispatcher & { sent: OutgoingMessage[] } {
  const sent: OutgoingMessage[] = [];
  const provider = (channel: ChannelProvider['channel']): ChannelProvider => ({
    channel,
    send: async (message) => {
      sent.push(message);
    },
  });
  const dispatcher = createDispatcher([provider('SMS'), provider('EMAIL'), provider('TELEGRAM')]);
  return Object.assign(dispatcher, { sent });
}

/** The 6-digit code from the last recorded message. */
export function lastCode(sent: OutgoingMessage[]): string {
  const text = sent.at(-1)?.text ?? '';
  const match = /\b(\d{6})\b/.exec(text);
  if (!match?.[1]) throw new Error(`no code in: ${text}`);
  return match[1];
}

export const settingsReader = (db: PrismaClient = prisma) => createSettingsReader(db);
