'use server';

import { cancelApprovalRequest, decideApprovalRequest } from '@gl/core';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { errorState, formString, type FormState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';

export async function decideAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const decision = formString(form, 'decision') === 'APPROVE' ? 'APPROVE' : 'REJECT';
  const result = await decideApprovalRequest(ctx, {
    id: formString(form, 'id'),
    decision,
    comment: formString(form, 'comment'),
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/', 'layout');
  const t = await getTranslations('approvals');
  return { ok: true, message: t(decision === 'APPROVE' ? 'approved' : 'rejected') };
}

export async function cancelAction(form: FormData) {
  const { ctx } = await requireAuth();
  await cancelApprovalRequest(ctx, formString(form, 'id'));
  revalidatePath('/approvals');
}
