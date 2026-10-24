'use client';

import { Button, Dialog } from '@gl/ui';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { decideAction } from './actions';

/** Approve / reject with a comment (required for a rejection). */
export function DecisionForm({ id, disabled }: { id: string; disabled?: boolean }) {
  const t = useTranslations('approvals');
  const tCommon = useTranslations('common');
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [state, action, actionPending] = useActionState(decideAction, {});

  useEffect(() => {
    if (state.ok) setDecision(null);
  }, [state]);

  return (
    <>
      <FormAlert tone="success">{state.ok ? state.message : null}</FormAlert>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon={<Check strokeWidth={2} aria-hidden />}
          disabled={disabled}
          onClick={() => setDecision('APPROVE')}
        >
          {t('approve')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<X strokeWidth={2} aria-hidden />}
          disabled={disabled}
          onClick={() => setDecision('REJECT')}
        >
          {t('reject')}
        </Button>
      </div>
      <Dialog
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision === 'APPROVE' ? t('approveTitle') : t('rejectTitle')}
        closeLabel={tCommon('close')}
      >
        <Form action={action} pending={actionPending} className="flex flex-col gap-4">
          <FormAlert tone="error">{state.error}</FormAlert>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value={decision ?? ''} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              {decision === 'REJECT' ? t('commentRequired') : t('commentOptional')}
            </span>
            <textarea
              name="comment"
              rows={3}
              required={decision === 'REJECT'}
              className="border-border bg-surface text-fg focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-3 rounded-xl border px-3.5 py-2.5 text-[0.9375rem] focus-visible:outline-none"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setDecision(null)}>
              {tCommon('cancel')}
            </Button>
            <SubmitButton variant={decision === 'REJECT' ? 'danger' : 'primary'}>
              {decision === 'REJECT' ? t('reject') : t('approve')}
            </SubmitButton>
          </div>
        </Form>
      </Dialog>
    </>
  );
}
