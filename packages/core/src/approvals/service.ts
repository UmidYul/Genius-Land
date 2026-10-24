import type { ApprovalRequest, Prisma } from '@gl/db';
import { assertCan, can } from '../access/can';
import { isRoleCode, type RoleCode } from '../access/roles';
import { requireScope } from '../access/scope';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';

/**
 * Approvals: important actions wait for the founder or the branch director. Which action types
 * need approval, and by whom, is data (`ApprovalPolicy`), not code — the founder approves what
 * matters, not every detail. Modules (finance, journal) create requests of their types and
 * register a handler that applies the change once approved.
 */
export interface ApprovalHandler {
  /** Runs in the same transaction as the approval: the change and the decision land together. */
  onApprove(tx: Prisma.TransactionClient, request: ApprovalRequest): Promise<void>;
  onReject?(tx: Prisma.TransactionClient, request: ApprovalRequest): Promise<void>;
}

const handlers = new Map<string, ApprovalHandler>();

export function registerApprovalHandler(type: string, handler: ApprovalHandler) {
  handlers.set(type, handler);
}

/** For tests. */
export function clearApprovalHandlers() {
  handlers.clear();
}

export interface CreateApprovalInput {
  type: string;
  /** Branch the request concerns; null — a school-wide request. */
  branchId: string | null;
  payload: Prisma.InputJsonValue;
  reason?: string | null;
}

export async function createApprovalRequest(
  ctx: ServiceContext,
  input: CreateApprovalInput,
): Promise<Result<ApprovalRequest>> {
  assertCan(ctx.actor, 'approvals.request.create', { branchId: input.branchId });
  const policy = await ctx.db.approvalPolicy.findUnique({ where: { type: input.type } });
  if (!policy || !policy.isActive) return err('APPROVAL_NO_POLICY', { type: input.type });

  const request = await ctx.db.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        type: input.type,
        branchId: input.branchId,
        payload: input.payload,
        reason: input.reason ?? null,
        approverRoleCode: policy.approverRoleCode,
        requestedById: ctx.actor.userId,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'approvals.request.create',
      entityType: 'ApprovalRequest',
      entityId: created.id,
      branchId: input.branchId,
      after: { type: input.type, payload: input.payload },
      reason: input.reason ?? null,
    });
    return created;
  });
  return ok(request);
}

/** Roles of the actor that can decide approval requests. */
const deciderRoles = (ctx: ServiceContext): RoleCode[] =>
  ctx.actor.roleCodes.filter((code) => isRoleCode(code));

/**
 * "Awaiting approval": pending requests addressed to one of the actor's roles, within the
 * branches the actor decides for (founder — all, director — own branch).
 */
export async function listApprovalQueue(ctx: ServiceContext) {
  const scope = requireScope(ctx.actor, 'approvals.request.decide', { branch: 'branchId' });
  if (!scope) return [];
  return ctx.db.approvalRequest.findMany({
    where: {
      AND: [
        scope as Prisma.ApprovalRequestWhereInput,
        { status: 'PENDING', approverRoleCode: { in: deciderRoles(ctx) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: { requestedBy: { select: { id: true, fullName: true } }, branch: true },
  });
}

/** Number of requests waiting for the actor — for the menu badge. */
export async function countApprovalQueue(ctx: ServiceContext): Promise<number> {
  if (!can(ctx.actor, 'approvals.request.decide')) return 0;
  const scope = requireScope(ctx.actor, 'approvals.request.decide', { branch: 'branchId' });
  if (!scope) return 0;
  return ctx.db.approvalRequest.count({
    where: {
      AND: [
        scope as Prisma.ApprovalRequestWhereInput,
        { status: 'PENDING', approverRoleCode: { in: deciderRoles(ctx) } },
      ],
    },
  });
}

/** Requests the actor created (any branch — they are the actor's own records). */
export function listMyApprovalRequests(ctx: ServiceContext) {
  return ctx.db.approvalRequest.findMany({
    // SELF scope: the branch is not restricted because the requester is the actor.
    where: { branchId: undefined, requestedById: ctx.actor.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function decideApprovalRequest(
  ctx: ServiceContext,
  input: { id: string; decision: 'APPROVE' | 'REJECT'; comment?: string | null },
): Promise<Result<ApprovalRequest>> {
  const request = await ctx.db.approvalRequest.findUnique({ where: { id: input.id } });
  // Someone outside the request's branch learns nothing, not even that it exists.
  if (
    !request ||
    !can(ctx.actor, 'approvals.request.decide', { branchId: request.branchId }) ||
    !deciderRoles(ctx).includes(request.approverRoleCode as RoleCode)
  ) {
    return err('NOT_FOUND');
  }
  if (request.status !== 'PENDING') return err('APPROVAL_NOT_PENDING');
  if (request.requestedById === ctx.actor.userId) return err('APPROVAL_OWN_REQUEST');
  const comment = input.comment?.trim() || null;
  if (input.decision === 'REJECT' && !comment) return err('APPROVAL_COMMENT_REQUIRED');

  const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const decided = await ctx.db.$transaction(async (tx) => {
    // Conditional update: two people deciding at once — only the first one wins.
    const { count } = await tx.approvalRequest.updateMany({
      where: { id: request.id, branchId: request.branchId, status: 'PENDING' },
      data: {
        status,
        decidedById: ctx.actor.userId,
        decidedAt: new Date(),
        decisionComment: comment,
      },
    });
    if (count !== 1) return null;
    const updated = await tx.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });
    const handler = handlers.get(request.type);
    if (status === 'APPROVED') await handler?.onApprove(tx, updated);
    else await handler?.onReject?.(tx, updated);
    await writeAudit(tx, auditActor(ctx), {
      action: status === 'APPROVED' ? 'approvals.request.approve' : 'approvals.request.reject',
      entityType: 'ApprovalRequest',
      entityId: request.id,
      branchId: request.branchId,
      before: { status: 'PENDING' },
      after: { status },
      reason: comment,
    });
    return updated;
  });
  return decided ? ok(decided) : err('APPROVAL_NOT_PENDING');
}

/** The requester withdraws a request that is still pending. */
export async function cancelApprovalRequest(
  ctx: ServiceContext,
  id: string,
): Promise<Result<{ id: string }>> {
  const request = await ctx.db.approvalRequest.findUnique({ where: { id } });
  if (!request || request.requestedById !== ctx.actor.userId) return err('NOT_FOUND');
  const { count } = await ctx.db.approvalRequest.updateMany({
    where: { id, branchId: request.branchId, status: 'PENDING' },
    data: { status: 'CANCELLED', decidedAt: new Date() },
  });
  if (count !== 1) return err('APPROVAL_NOT_PENDING');
  await writeAudit(ctx.db, auditActor(ctx), {
    action: 'approvals.request.cancel',
    entityType: 'ApprovalRequest',
    entityId: id,
    branchId: request.branchId,
    before: { status: 'PENDING' },
    after: { status: 'CANCELLED' },
  });
  return ok({ id });
}
