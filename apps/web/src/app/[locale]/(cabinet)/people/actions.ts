'use server';

import {
  addGuardian,
  changeStudentStatus,
  createStaff,
  createStudent,
  setStaffArchived,
  transferStudent,
  unlinkGuardian,
  updateGuardianLink,
  updateStaff,
  updateStudent,
} from '@gl/core';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { errorState, formString, type FormState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';

const saved = async (): Promise<FormState> => ({
  ok: true,
  message: (await getTranslations('common'))('saved'),
});

const staffFields = (form: FormData) => ({
  fullName: formString(form, 'fullName'),
  phone: formString(form, 'phone'),
  position: formString(form, 'position'),
});

export async function saveStaffAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const id = formString(form, 'id');
  const result = id
    ? await updateStaff(ctx, id, staffFields(form))
    : await createStaff(ctx, staffFields(form));
  if (!result.ok) return errorState(result.error);
  revalidatePath('/people/staff');
  return saved();
}

export async function archiveStaffAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await setStaffArchived(
    ctx,
    formString(form, 'id'),
    formString(form, 'archived') === '1',
  );
  if (!result.ok) return errorState(result.error);
  revalidatePath('/people/staff');
  return saved();
}

const studentFields = (form: FormData) => ({
  lastName: formString(form, 'lastName'),
  firstName: formString(form, 'firstName'),
  middleName: formString(form, 'middleName'),
  birthDate: formString(form, 'birthDate'),
  gender: formString(form, 'gender') === 'FEMALE' ? ('FEMALE' as const) : ('MALE' as const),
  gradeLevel: Number(formString(form, 'gradeLevel')),
  emergencyContactName: formString(form, 'emergencyContactName'),
  emergencyContactPhone: formString(form, 'emergencyContactPhone'),
});

export async function createStudentAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await createStudent(ctx, {
    ...studentFields(form),
    classId: formString(form, 'classId') || null,
    confirmDuplicate: formString(form, 'confirmDuplicate') === '1',
  });
  if (!result.ok) {
    const state = await errorState(result.error);
    // A possible duplicate is a warning: the form offers to save anyway.
    const duplicate = result.error.code.startsWith('STUDENT_POSSIBLE_DUPLICATE');
    return duplicate ? { ...state, secret: 'duplicate' } : state;
  }
  revalidatePath('/people/students');
  return { ok: true, id: result.value.id, message: result.value.number };
}

export async function updateStudentAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const id = formString(form, 'id');
  const result = await updateStudent(ctx, id, studentFields(form));
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/people/students/${id}`);
  return saved();
}

export async function transferStudentAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const studentId = formString(form, 'studentId');
  const result = await transferStudent(ctx, {
    studentId,
    toClassId: formString(form, 'toClassId'),
    gradeLevel: Number(formString(form, 'gradeLevel')) || undefined,
    reason: formString(form, 'reason'),
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/people/students/${studentId}`);
  return saved();
}

export async function statusStudentAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const studentId = formString(form, 'studentId');
  const status = formString(form, 'status') as 'ACTIVE' | 'LEFT' | 'GRADUATED' | 'TRANSFERRED';
  const result = await changeStudentStatus(ctx, {
    studentId,
    status,
    reason: formString(form, 'reason'),
    date: formString(form, 'date') || undefined,
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/people/students/${studentId}`);
  return saved();
}

export async function addGuardianAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const studentId = formString(form, 'studentId');
  const relation = formString(form, 'relation') as 'MOTHER' | 'FATHER' | 'GUARDIAN' | 'OTHER';
  const result = await addGuardian(ctx, {
    studentId,
    fullName: formString(form, 'fullName'),
    phone: formString(form, 'phone'),
    relation,
    isPrimary: form.get('isPrimary') === 'on',
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/people/students/${studentId}`);
  return saved();
}

export async function guardianLinkAction(form: FormData) {
  const { ctx } = await requireAuth();
  const studentId = formString(form, 'studentId');
  const guardianId = formString(form, 'guardianId');
  if (formString(form, 'command') === 'unlink')
    await unlinkGuardian(ctx, { studentId, guardianId });
  else await updateGuardianLink(ctx, { studentId, guardianId, isPrimary: true });
  revalidatePath(`/people/students/${studentId}`);
}
