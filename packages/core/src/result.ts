import { translate, type Locale, type MessageParams } from '@gl/i18n';

/**
 * Error codes of the domain layer. Each code has a text in both dictionaries
 * (`errors.<CODE>` in `@gl/i18n`) — a test enforces it. Never put user-facing text in an error.
 */
export const errorCodes = [
  'INTERNAL',
  'VALIDATION',
  'NOT_FOUND',
  'FORBIDDEN',
  'UNAUTHENTICATED',
  'CONFLICT',
  'SETTING_UNKNOWN',
  'SETTING_INVALID',
  'MONEY_INVALID',
  'MONEY_NEGATIVE',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface AppError {
  code: ErrorCode;
  /** Values for the message placeholders, e.g. `{ key: 'finance.dueDay' }`. */
  params?: MessageParams;
  /** Per-field validation problems: field path → error code. */
  fields?: Record<string, ErrorCode>;
}

export type Result<T, E extends AppError = AppError> =
  { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = (
  code: ErrorCode,
  params?: MessageParams,
  fields?: Record<string, ErrorCode>,
): Result<never> => ({
  ok: false,
  error: { code, ...(params && { params }), ...(fields && { fields }) },
});

/** Thrown form of {@link AppError} for places where a Result cannot be returned. */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly params?: MessageParams;

  constructor(code: ErrorCode, params?: MessageParams) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
    if (params) this.params = params;
  }

  toAppError(): AppError {
    return { code: this.code, ...(this.params && { params: this.params }) };
  }
}

/** Unwraps a Result or throws a {@link DomainError}. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new DomainError(result.error.code, result.error.params);
}

/** User-facing text for an error in the given language. */
export function errorMessage(error: AppError, locale: Locale): string {
  return translate(locale, `errors.${error.code}`, error.params);
}
