import type { PrismaClient } from '@gl/db';
import type { Actor } from './access/actor';
import { guardBranchQueries } from './access/guard';
import type { ActorContext } from './audit';

/**
 * Every service that works with school data takes this context: the actor is mandatory,
 * and `db` is the branch-guarded client (see access/guard.ts).
 */
export interface ServiceContext {
  db: PrismaClient;
  actor: Actor;
  ip?: string | null;
}

const guarded = new WeakMap<PrismaClient, PrismaClient>();

export function createServiceContext(
  db: PrismaClient,
  actor: Actor,
  ip?: string | null,
): ServiceContext {
  let client = guarded.get(db);
  if (!client) {
    client = guardBranchQueries(db);
    guarded.set(db, client);
  }
  return { db: client, actor, ip: ip ?? null };
}

/** Audit identity of the context's actor. */
export const auditActor = (ctx: ServiceContext): ActorContext => ({
  actorId: ctx.actor.userId,
  ip: ctx.ip ?? null,
});
