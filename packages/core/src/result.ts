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
  // Sign-in
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_LOCKED',
  'AUTH_BLOCKED',
  'AUTH_RATE_LIMITED',
  'AUTH_CODE_INVALID',
  'AUTH_CODE_EXPIRED',
  'AUTH_CODE_TOO_SOON',
  'AUTH_NO_CHANNEL',
  // Passwords and contacts
  'PASSWORD_WEAK',
  'PASSWORD_MISMATCH',
  'PASSWORD_WRONG',
  'PHONE_INVALID',
  'PHONE_TAKEN',
  'EMAIL_INVALID',
  'EMAIL_TAKEN',
  // Administration
  'ROLE_ESCALATION',
  'ROLE_BRANCH_REQUIRED',
  'LAST_SUPERADMIN',
  'SELF_ACTION',
  'BRANCH_CODE_TAKEN',
  // Approvals
  'APPROVAL_NO_POLICY',
  'APPROVAL_NOT_PENDING',
  'APPROVAL_OWN_REQUEST',
  'APPROVAL_COMMENT_REQUIRED',
  // School structure
  'BRANCH_REQUIRED',
  'YEAR_NOT_FOUND',
  'YEAR_NAME_TAKEN',
  'YEAR_TERMS_INVALID',
  'CALENDAR_DAY_TAKEN',
  'SUBJECT_NAME_TAKEN',
  'DIRECTION_NAME_TAKEN',
  'DIRECTION_NOT_FOUND',
  'CLASS_NAME_TAKEN',
  'CLASS_GRADE_REQUIRED',
  'CLASS_DIRECTION_REQUIRED',
  'CLASS_CAPACITY_BELOW_OCCUPANCY',
  'CLASS_HAS_STUDENTS',
  'CLASS_ARCHIVED',
  'CLASS_NOT_FOUND',
  'CLASS_FULL',
  'CLASS_GRADE_MISMATCH',
  'GROUP_GRADE_INVALID',
  'ASSIGNMENT_EXISTS',
  // People
  'STAFF_PHONE_TAKEN',
  'STAFF_NOT_FOUND',
  'STAFF_IS_HOMEROOM',
  'BIRTHDATE_INVALID',
  'STUDENT_POSSIBLE_DUPLICATE',
  'STUDENT_POSSIBLE_DUPLICATE_OTHER_BRANCH',
  'STUDENT_NOT_FOUND',
  'STUDENT_NOT_ACTIVE',
  'REASON_REQUIRED',
  'GUARDIAN_ALREADY_LINKED',
  // Import
  'IMPORT_FILE_INVALID',
  'IMPORT_MISSING_COLUMNS',
  'IMPORT_EMPTY',
  'IMPORT_TOO_LARGE',
  'IMPORT_REQUIRED',
  'IMPORT_VALUE_UNKNOWN',
  'IMPORT_NUMBER_INVALID',
  'IMPORT_DUPLICATE_IN_FILE',
  'IMPORT_POSSIBLE_DUPLICATE',
  'IMPORT_ALREADY_DONE',
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
