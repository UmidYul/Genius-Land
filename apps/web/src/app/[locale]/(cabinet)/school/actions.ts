'use server';

import {
  addCalendarDay,
  addTeachingAssignment,
  createAcademicYear,
  createClass,
  removeCalendarDay,
  removeTeachingAssignment,
  saveCatalogItem,
  setCatalogArchived,
  setClassArchived,
  setCurrentYear,
  updateClass,
  updateTerms,
  type CatalogKind,
} from '@gl/core';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { errorState, formString, type FormState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';

const saved = async (): Promise<FormState> => ({
  ok: true,
  message: (await getTranslations('common'))('saved'),
});

const terms = (form: FormData) =>
  [1, 2, 3, 4].map((n) => ({
    startDate: formString(form, `term${n}Start`),
    endDate: formString(form, `term${n}End`),
  }));

export async function createYearAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await createAcademicYear(ctx, {
    name: formString(form, 'name'),
    terms: terms(form),
    makeCurrent: form.get('makeCurrent') === 'on',
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/school/years');
  return saved();
}

export async function updateTermsAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await updateTerms(ctx, formString(form, 'yearId'), terms(form));
  if (!result.ok) return errorState(result.error);
  revalidatePath('/school/years');
  return saved();
}

export async function setCurrentYearAction(form: FormData) {
  const { ctx } = await requireAuth();
  await setCurrentYear(ctx, formString(form, 'yearId'));
  revalidatePath('/school', 'layout');
}

export async function addCalendarDayAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const scope = formString(form, 'scope');
  const classType = formString(form, 'classType');
  const result = await addCalendarDay(ctx, {
    date: formString(form, 'date'),
    kind: formString(form, 'kind') === 'WORKDAY' ? 'WORKDAY' : 'HOLIDAY',
    classType: classType === 'REGULAR' || classType === 'DIRECTION_GROUP' ? classType : null,
    note: formString(form, 'note'),
    branchId: scope === 'all' ? null : scope,
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/school/calendar');
  return saved();
}

export async function removeCalendarDayAction(form: FormData) {
  const { ctx } = await requireAuth();
  await removeCalendarDay(ctx, formString(form, 'id'));
  revalidatePath('/school/calendar');
}

export async function saveCatalogAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const kind: CatalogKind = formString(form, 'kind') === 'direction' ? 'direction' : 'subject';
  const result = await saveCatalogItem(
    ctx,
    kind,
    { nameUz: formString(form, 'nameUz'), nameRu: formString(form, 'nameRu') },
    formString(form, 'id') || undefined,
  );
  if (!result.ok) return errorState(result.error);
  revalidatePath('/school/catalog');
  return saved();
}

export async function archiveCatalogAction(form: FormData) {
  const { ctx } = await requireAuth();
  const kind: CatalogKind = formString(form, 'kind') === 'direction' ? 'direction' : 'subject';
  await setCatalogArchived(ctx, kind, formString(form, 'id'), formString(form, 'archived') === '1');
  revalidatePath('/school/catalog');
}

const classFields = (form: FormData) => ({
  name: formString(form, 'name'),
  gradeLevel: Number(formString(form, 'gradeLevel')) || null,
  directionId: formString(form, 'directionId') || null,
  capacity: Number(formString(form, 'capacity')),
  homeroomTeacherId: formString(form, 'homeroomTeacherId'),
});

export async function createClassAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const type = formString(form, 'type') === 'DIRECTION_GROUP' ? 'DIRECTION_GROUP' : 'REGULAR';
  const result = await createClass(ctx, { type, ...classFields(form) });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/school/classes');
  return { ...(await saved()), id: result.value.id };
}

export async function updateClassAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const id = formString(form, 'id');
  const result = await updateClass(ctx, id, classFields(form));
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/school/classes/${id}`);
  return saved();
}

export async function archiveClassAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const id = formString(form, 'id');
  const result = await setClassArchived(ctx, id, formString(form, 'archived') === '1');
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/school/classes/${id}`);
  return saved();
}

export async function addAssignmentAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const classId = formString(form, 'classId');
  const result = await addTeachingAssignment(ctx, {
    classId,
    subjectId: formString(form, 'subjectId'),
    staffId: formString(form, 'staffId'),
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/school/classes/${classId}`);
  return saved();
}

export async function removeAssignmentAction(form: FormData) {
  const { ctx } = await requireAuth();
  await removeTeachingAssignment(ctx, formString(form, 'id'));
  revalidatePath(`/school/classes/${formString(form, 'classId')}`);
}
