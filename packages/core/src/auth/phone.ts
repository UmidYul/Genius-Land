/**
 * Uzbek mobile numbers in one canonical form: +998XXXXXXXXX.
 * Accepts what staff actually type: "+998 90 123-45-67", "998901234567", "90 123 45 67".
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s()\-.]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;
  const national = digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits;
  if (!/^\d{9}$/.test(national)) return null;
  return `+998${national}`;
}

/** "+998 90 123 45 67" — for display. */
export function formatPhone(phone: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** "+998 90 *** ** 67" — where a code was sent, without revealing the whole number. */
export function maskPhone(phone: string): string {
  const m = /^\+998(\d{2})\d{5}(\d{2})$/.exec(phone);
  return m ? `+998 ${m[1]} *** ** ${m[2]}` : phone;
}

/** "u***@example.com" */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}
