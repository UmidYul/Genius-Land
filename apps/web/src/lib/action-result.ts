import 'server-only';
import type { AppError } from '@gl/core';
import type { MessageKey } from '@gl/i18n';
import { getTranslations } from 'next-intl/server';

/** What a form's server action returns to useActionState. All texts are already translated. */
export interface FormState {
  ok?: boolean;
  /** Message for the whole form. */
  error?: string;
  /** Message per field name. */
  fields?: Record<string, string>;
  /** Success message or a one-time value (e.g. a temporary password). */
  message?: string;
  secret?: string;
  /** Id of a created record. */
  id?: string;
}

export const initialFormState: FormState = {};

/** Translates a domain error into form state: a form-level message plus per-field messages. */
export async function errorState(error: AppError): Promise<FormState> {
  const t = await getTranslations();
  const text = (code: string) => t(`errors.${code}` as MessageKey, error.params ?? {});
  return {
    error: text(error.code),
    fields: error.fields
      ? Object.fromEntries(Object.entries(error.fields).map(([field, code]) => [field, text(code)]))
      : undefined,
  };
}

export const formString = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};
