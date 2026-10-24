import { describe, expect, it } from 'vitest';
import { actorFromDefinitions } from '../testing/fixtures';
import { can } from './can';
import { hasBranchCondition } from './guard';
import { scopeWhere } from './scope';
import { resolveActiveBranch } from './actor';

const A = 'branch-a';
const B = 'branch-b';
const ALL = [A, B];

describe('scopeWhere', () => {
  it('BRANCH: only assigned branches', () => {
    const director = actorFromDefinitions([{ role: 'DIRECTOR', branchIds: [A] }], {
      allBranchIds: ALL,
    });
    expect(scopeWhere(director, 'approvals.request.view', { branch: 'branchId' })).toEqual({
      branchId: { in: [A] },
    });
  });

  it('ALL_BRANCHES: any branch, but still names the branch column', () => {
    const founder = actorFromDefinitions([{ role: 'FOUNDER', branchIds: [] }], {
      allBranchIds: ALL,
    });
    const where = scopeWhere(founder, 'approvals.request.view', { branch: 'branchId' });
    expect(where).toEqual({ branchId: undefined });
    expect(hasBranchCondition(where, 'branchId')).toBe(true);
  });

  it('the branch switcher narrows ALL_BRANCHES and BRANCH to the chosen branch', () => {
    const founder = actorFromDefinitions([{ role: 'FOUNDER', branchIds: [] }], {
      allBranchIds: ALL,
      activeBranchId: B,
    });
    expect(scopeWhere(founder, 'approvals.request.view', { branch: 'branchId' })).toEqual({
      branchId: { in: [B] },
    });
    const accountant = actorFromDefinitions([{ role: 'ACCOUNTANT', branchIds: [A, B] }], {
      allBranchIds: ALL,
      activeBranchId: A,
    });
    expect(scopeWhere(accountant, 'finance.payment.view', { branch: 'branchId' })).toEqual({
      branchId: { in: [A] },
    });
  });

  it('the switcher never widens: choosing a foreign branch yields nothing', () => {
    const director = actorFromDefinitions([{ role: 'DIRECTOR', branchIds: [A] }], {
      allBranchIds: ALL,
      activeBranchId: B,
    });
    expect(scopeWhere(director, 'approvals.request.view', { branch: 'branchId' })).toBeNull();
  });

  it('ASSIGNED: branch + taught classes; nothing when the model has no class column', () => {
    const teacher = actorFromDefinitions([{ role: 'TEACHER', branchIds: [A] }], {
      allBranchIds: ALL,
      relations: {
        teaching: [
          { classId: 'c1', subjectId: 's1' },
          { classId: 'c1', subjectId: 's2' },
        ],
      },
    });
    expect(
      scopeWhere(teacher, 'journal.grade.view', { branch: 'branchId', class: 'classId' }),
    ).toEqual({
      branchId: { in: [A] },
      classId: { in: ['c1'] },
    });
    expect(scopeWhere(teacher, 'journal.grade.view', { branch: 'branchId' })).toBeNull();
  });

  it('ASSIGNED with no classes yet (stage 1 stub) gives no access', () => {
    const teacher = actorFromDefinitions([{ role: 'TEACHER', branchIds: [A] }], {
      allBranchIds: ALL,
    });
    expect(
      scopeWhere(teacher, 'journal.grade.view', { branch: 'branchId', class: 'classId' }),
    ).toBeNull();
    expect(can(teacher, 'journal.grade.view', { branchId: A, classId: 'c1' })).toBe(false);
  });

  it('CHILDREN and SELF filter by student', () => {
    const parent = actorFromDefinitions([{ role: 'PARENT', branchIds: [] }], {
      allBranchIds: ALL,
      relations: { childStudentIds: ['kid1', 'kid2'] },
    });
    expect(
      scopeWhere(parent, 'journal.grade.view', { branch: 'branchId', student: 'studentId' }),
    ).toEqual({
      branchId: undefined,
      studentId: { in: ['kid1', 'kid2'] },
    });
    const student = actorFromDefinitions([{ role: 'STUDENT', branchIds: [] }], {
      allBranchIds: ALL,
      relations: { selfStudentId: 'me-student' },
    });
    expect(
      scopeWhere(student, 'journal.grade.view', { branch: 'branchId', student: 'studentId' }),
    ).toEqual({
      branchId: undefined,
      OR: [{ studentId: 'me-student' }],
    });
  });
});

describe('can — scope details', () => {
  const teacher = actorFromDefinitions([{ role: 'TEACHER', branchIds: [A] }], {
    allBranchIds: ALL,
    relations: { teaching: [{ classId: 'c1', subjectId: 'math' }], homeroomClassIds: ['c9'] },
  });

  it('ASSIGNED checks the subject when given', () => {
    expect(
      can(teacher, 'journal.grade.write', { branchId: A, classId: 'c1', subjectId: 'math' }),
    ).toBe(true);
    expect(
      can(teacher, 'journal.grade.write', { branchId: A, classId: 'c1', subjectId: 'art' }),
    ).toBe(false);
    expect(can(teacher, 'journal.grade.write', { branchId: A, classId: 'c2' })).toBe(false);
  });

  it('HOMEROOM: broadcast only to the homeroom class', () => {
    expect(can(teacher, 'notifications.broadcast.send', { branchId: A, classId: 'c9' })).toBe(true);
    expect(can(teacher, 'notifications.broadcast.send', { branchId: A, classId: 'c1' })).toBe(
      false,
    );
    expect(can(teacher, 'notifications.broadcast.send', { branchId: A })).toBe(false);
  });

  it('roles combine: a teacher who is also an accountant gets both sets', () => {
    const both = actorFromDefinitions(
      [
        { role: 'TEACHER', branchIds: [A] },
        { role: 'ACCOUNTANT', branchIds: [B] },
      ],
      { allBranchIds: ALL },
    );
    expect(can(both, 'finance.payment.create', { branchId: B })).toBe(true);
    expect(can(both, 'finance.payment.create', { branchId: A })).toBe(false);
  });
});

describe('hasBranchCondition', () => {
  it.each([
    [{ branchId: 'x' }, true],
    [{ branchId: undefined }, true],
    [{ AND: [{ status: 'PENDING' }, { branchId: { in: ['x'] } }] }, true],
    [{ OR: [{ branchId: 'x' }, { branchId: 'y' }] }, true],
    [{ OR: [{ branchId: 'x' }, { status: 'PENDING' }] }, false],
    [{ OR: [] }, false],
    [{ status: 'PENDING' }, false],
    [undefined, false],
  ])('%j → %s', (where, expected) => {
    expect(hasBranchCondition(where, 'branchId')).toBe(expected);
  });
});

describe('resolveActiveBranch', () => {
  const branches = [
    { id: A, nameUz: 'A', nameRu: 'A' },
    { id: B, nameUz: 'B', nameRu: 'B' },
  ];
  it('keeps a visible saved choice, else all (founder) or the first branch', () => {
    expect(resolveActiveBranch(B, branches, false)).toBe(B);
    expect(resolveActiveBranch('gone', branches, true)).toBeNull();
    expect(resolveActiveBranch(null, branches, false)).toBe(A);
    expect(resolveActiveBranch(null, [], false)).toBeNull();
  });
});
