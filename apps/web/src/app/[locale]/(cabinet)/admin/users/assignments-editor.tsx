'use client';

import { cn } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export interface RoleOption {
  code: string;
  branchBound: boolean;
  /** Above the editor's own rank: shown, cannot be changed. */
  locked: boolean;
}

export interface Assignment {
  roleCode: string;
  branchIds: string[];
}

/**
 * Roles with their branches. The value goes to the server as JSON in a hidden input; the server
 * re-checks every rule (rank, branch-bound roles, last superadmin).
 */
export function AssignmentsEditor({
  roles,
  branches,
  initial,
}: {
  roles: RoleOption[];
  branches: { id: string; name: string }[];
  initial: Assignment[];
}) {
  const t = useTranslations('admin.users');
  const tRoles = useTranslations('roles');
  const [value, setValue] = useState<Assignment[]>(initial);

  const toggleRole = (role: RoleOption) =>
    setValue((current) =>
      current.some((a) => a.roleCode === role.code)
        ? current.filter((a) => a.roleCode !== role.code)
        : [
            ...current,
            {
              roleCode: role.code,
              // A single branch is preselected — the common case.
              branchIds: role.branchBound && branches.length === 1 ? [branches[0]!.id] : [],
            },
          ],
    );

  const toggleBranch = (roleCode: string, branchId: string) =>
    setValue((current) =>
      current.map((a) =>
        a.roleCode !== roleCode
          ? a
          : {
              ...a,
              branchIds: a.branchIds.includes(branchId)
                ? a.branchIds.filter((id) => id !== branchId)
                : [...a.branchIds, branchId],
            },
      ),
    );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{t('roles')}</legend>
      <input type="hidden" name="assignments" value={JSON.stringify(value)} />
      {roles.map((role) => {
        const assignment = value.find((a) => a.roleCode === role.code);
        const checked = !!assignment;
        return (
          <div
            key={role.code}
            className={cn(
              'flex flex-col gap-2 rounded-xl p-3 transition-[background-color] duration-150',
              checked ? 'bg-primary-soft' : 'bg-surface-2',
            )}
          >
            <label
              className={cn(
                'flex min-h-6 items-center gap-3',
                role.locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={role.locked}
                onChange={() => toggleRole(role)}
                className="accent-primary-solid size-5"
              />
              <span className="text-sm font-semibold">{tRoles(role.code as 'TEACHER')}</span>
            </label>
            {checked && role.branchBound && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 ps-8">
                {branches.map((branch) => (
                  <label key={branch.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={assignment.branchIds.includes(branch.id)}
                      disabled={role.locked}
                      onChange={() => toggleBranch(role.code, branch.id)}
                      className="accent-primary-solid size-4"
                    />
                    {branch.name}
                  </label>
                ))}
                {assignment.branchIds.length === 0 && (
                  <p className="text-warning-fg w-full text-xs">{t('pickBranch')}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
