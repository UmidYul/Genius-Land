import { prisma } from '@gl/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { listAuditLog } from '../admin/audit-log';
import {
  createApprovalRequest,
  decideApprovalRequest,
  listApprovalQueue,
  listMyApprovalRequests,
} from '../approvals/service';
import { writeAudit } from '../audit';
import { createServiceContext } from '../context';
import { setPreferredBranch } from '../profile/service';
import { contextFor, createUser, setupWorld, type TestWorld } from '../testing/fixtures';
import { loadActor } from './actor';
import { can } from './can';
import { branchOwnedModels, UnscopedQueryError } from './guard';
import { permissionCodes } from './permissions';
import { roleDefinitions } from './roles';
import { scopeWhere } from './scope';

let world: TestWorld;

beforeEach(async () => {
  world = await setupWorld();
  await prisma.approvalPolicy.createMany({
    data: [
      { type: 'test.director', approverRoleCode: 'DIRECTOR' },
      { type: 'test.founder', approverRoleCode: 'FOUNDER' },
    ],
  });
});

async function requestIn(branchId: string | null, type = 'test.director') {
  const accountant = await createUser({
    roles: [{ role: 'ACCOUNTANT', branchIds: [world.branchA, world.branchB] }],
  });
  const ctx = await contextFor(accountant.id);
  const created = await createApprovalRequest(ctx, { type, branchId, payload: { amount: '1' } });
  if (!created.ok) throw new Error(created.error.code);
  return created.value;
}

describe('grants in the database match the role definitions', () => {
  it.each(Object.keys(roleDefinitions))('%s', async (role) => {
    const user = await createUser({
      roles: [{ role: role as keyof typeof roleDefinitions, branchIds: [world.branchA] }],
    });
    const actor = (await loadActor(prisma, user.id))!;
    const def = roleDefinitions[role as keyof typeof roleDefinitions];
    for (const permission of permissionCodes) {
      expect(actor.grants.get(permission)?.[0]?.scope, permission).toBe(def.grants[permission]);
    }
  });
});

describe('director, administrator and teacher see nothing of the other branch', () => {
  it.each(['DIRECTOR', 'ADMINISTRATOR', 'TEACHER'] as const)('%s', async (role) => {
    const user = await createUser({ roles: [{ role, branchIds: [world.branchA] }] });
    const ctx = await contextFor(user.id);
    expect(ctx.actor.branches.map((b) => b.id)).toEqual([world.branchA]);

    // Records of the other branch exist…
    const foreign = await requestIn(world.branchB);
    await writeAudit(
      prisma,
      { actorId: null },
      {
        action: 'test.event',
        entityType: 'Thing',
        branchId: world.branchB,
      },
    );

    // …and are invisible through every permission and every path.
    for (const permission of permissionCodes) {
      expect(can(ctx.actor, permission, { branchId: world.branchB }), permission).toBe(false);
      const where = scopeWhere(ctx.actor, permission, { branch: 'branchId' });
      if (where) {
        const rows = await ctx.db.approvalRequest.findMany({ where: where as object });
        expect(
          rows.map((r) => r.id),
          permission,
        ).not.toContain(foreign.id);
      }
    }
    if (can(ctx.actor, 'approvals.request.decide')) {
      expect(await listApprovalQueue(ctx)).toEqual([]);
    }
    expect(await decideApprovalRequest(ctx, { id: foreign.id, decision: 'APPROVE' })).toMatchObject(
      {
        ok: false,
        error: { code: 'NOT_FOUND' },
      },
    );
    await expect(listAuditLog(ctx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('the branch switcher cannot be pointed at a foreign branch', async () => {
    const user = await createUser({ roles: [{ role: 'DIRECTOR', branchIds: [world.branchA] }] });
    const ctx = await contextFor(user.id);
    expect(await setPreferredBranch(ctx, world.branchB)).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
    expect(await setPreferredBranch(ctx, null)).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});

describe('founder: both branches, narrowed by the switcher', () => {
  it('sees founder-level requests of both branches; switcher narrows; choice is remembered', async () => {
    const founder = await createUser({ roles: [{ role: 'FOUNDER' }] });
    const inA = await requestIn(world.branchA, 'test.founder');
    const inB = await requestIn(world.branchB, 'test.founder');
    await requestIn(world.branchA, 'test.director'); // not the founder's

    let ctx = await contextFor(founder.id);
    expect(ctx.actor.activeBranchId).toBeNull();
    expect((await listApprovalQueue(ctx)).map((r) => r.id).sort()).toEqual([inA.id, inB.id].sort());

    expect((await setPreferredBranch(ctx, world.branchB)).ok).toBe(true);
    ctx = await contextFor(founder.id);
    expect(ctx.actor.activeBranchId).toBe(world.branchB);
    expect((await listApprovalQueue(ctx)).map((r) => r.id)).toEqual([inB.id]);

    expect((await setPreferredBranch(ctx, null)).ok).toBe(true);
    ctx = await contextFor(founder.id);
    expect((await listApprovalQueue(ctx)).length).toBe(2);
  });

  it('an accountant with both branches switches between them but has no "all"', async () => {
    const accountant = await createUser({
      roles: [{ role: 'ACCOUNTANT', branchIds: [world.branchA, world.branchB] }],
    });
    const ctx = await contextFor(accountant.id);
    expect(ctx.actor.hasAllBranches).toBe(false);
    expect(ctx.actor.activeBranchId).toBe(world.branchA);
    expect(await setPreferredBranch(ctx, null)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect((await setPreferredBranch(ctx, world.branchB)).ok).toBe(true);
  });
});

describe('approvals', () => {
  it('director decides requests of their branch; the decision is audited', async () => {
    const director = await createUser({
      roles: [{ role: 'DIRECTOR', branchIds: [world.branchA] }],
    });
    const request = await requestIn(world.branchA);
    const ctx = await contextFor(director.id);
    expect((await listApprovalQueue(ctx)).map((r) => r.id)).toEqual([request.id]);

    expect(await decideApprovalRequest(ctx, { id: request.id, decision: 'REJECT' })).toMatchObject({
      error: { code: 'APPROVAL_COMMENT_REQUIRED' },
    });
    const decided = await decideApprovalRequest(ctx, {
      id: request.id,
      decision: 'APPROVE',
      comment: 'ok',
    });
    expect(decided).toMatchObject({
      ok: true,
      value: { status: 'APPROVED', decidedById: director.id },
    });
    expect(await decideApprovalRequest(ctx, { id: request.id, decision: 'APPROVE' })).toMatchObject(
      {
        error: { code: 'APPROVAL_NOT_PENDING' },
      },
    );
    expect(
      await prisma.auditLog.count({
        where: { action: 'approvals.request.approve', entityId: request.id },
      }),
    ).toBe(1);
  });

  it('a director cannot decide founder-level requests, nor their own', async () => {
    const director = await createUser({
      roles: [{ role: 'DIRECTOR', branchIds: [world.branchA] }],
    });
    const ctx = await contextFor(director.id);
    const founderLevel = await requestIn(world.branchA, 'test.founder');
    expect(
      await decideApprovalRequest(ctx, { id: founderLevel.id, decision: 'APPROVE' }),
    ).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    const own = await createApprovalRequest(ctx, {
      type: 'test.director',
      branchId: world.branchA,
      payload: {},
    });
    if (!own.ok) throw new Error(own.error.code);
    expect(
      await decideApprovalRequest(ctx, { id: own.value.id, decision: 'APPROVE' }),
    ).toMatchObject({
      error: { code: 'APPROVAL_OWN_REQUEST' },
    });
    expect((await listMyApprovalRequests(ctx)).map((r) => r.id)).toEqual([own.value.id]);
  });

  it('requests need a policy, and the creator must reach the branch', async () => {
    const accountant = await createUser({
      roles: [{ role: 'ACCOUNTANT', branchIds: [world.branchA] }],
    });
    const ctx = await contextFor(accountant.id);
    expect(
      await createApprovalRequest(ctx, {
        type: 'unknown.type',
        branchId: world.branchA,
        payload: {},
      }),
    ).toMatchObject({ error: { code: 'APPROVAL_NO_POLICY' } });
    await expect(
      createApprovalRequest(ctx, { type: 'test.director', branchId: world.branchB, payload: {} }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('the branch guard on the service client', () => {
  it('rejects multi-row queries of branch-owned models without a branch condition', async () => {
    const founder = await createUser({ roles: [{ role: 'FOUNDER' }] });
    const actor = (await loadActor(prisma, founder.id))!;
    const ctx = createServiceContext(prisma, actor);
    await expect(
      ctx.db.approvalRequest.findMany({ where: { status: 'PENDING' } }),
    ).rejects.toBeInstanceOf(UnscopedQueryError);
    await expect(ctx.db.approvalRequest.count()).rejects.toBeInstanceOf(UnscopedQueryError);
    await expect(
      ctx.db.$transaction((tx) =>
        tx.approvalRequest.updateMany({ where: {}, data: { reason: 'x' } }),
      ),
    ).rejects.toBeInstanceOf(UnscopedQueryError);
    // Scoped queries pass.
    const where = scopeWhere(actor, 'approvals.request.view', { branch: 'branchId' })!;
    await expect(ctx.db.approvalRequest.findMany({ where: where as object })).resolves.toEqual([]);
  });

  it('every guarded model exists in the client', () => {
    for (const model of Object.keys(branchOwnedModels)) {
      const key = model.charAt(0).toLowerCase() + model.slice(1);
      expect(prisma, model).toHaveProperty(key);
    }
  });
});

describe('audit log visibility', () => {
  it('superadmin sees everything; founder sees all branches and follows the switcher', async () => {
    await writeAudit(
      prisma,
      { actorId: null },
      { action: 'x.a', entityType: 'T', branchId: world.branchA },
    );
    await writeAudit(
      prisma,
      { actorId: null },
      { action: 'x.b', entityType: 'T', branchId: world.branchB },
    );
    await writeAudit(prisma, { actorId: null }, { action: 'x.global', entityType: 'T' });

    const superadmin = await createUser({ roles: [{ role: 'SUPERADMIN' }] });
    expect((await listAuditLog(await contextFor(superadmin.id), { action: 'x.' })).total).toBe(3);

    const founder = await createUser({ roles: [{ role: 'FOUNDER' }] });
    let ctx = await contextFor(founder.id);
    expect((await listAuditLog(ctx, { action: 'x.' })).total).toBe(3);
    await setPreferredBranch(ctx, world.branchA);
    ctx = await contextFor(founder.id);
    expect((await listAuditLog(ctx, { action: 'x.' })).entries.map((e) => e.action)).toEqual([
      'x.a',
    ]);
  });
});
