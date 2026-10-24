import { assertCan } from '../access/can';
import { authSettings } from '../auth/settings';
import { auditActor, type ServiceContext } from '../context';
import { err, type Result } from '../result';
import { createSettingsReader, updateSetting, type SettingDefinition } from '../settings';

/**
 * Every setting the superadmin can edit. Modules add their definitions here as they appear
 * (journal edit windows, tuition policy…). Labels: `settings.<key>` in the dictionaries.
 */
export const settingsRegistry: readonly SettingDefinition<unknown>[] = [
  ...Object.values(authSettings),
] as SettingDefinition<unknown>[];

export function findSettingDefinition(key: string) {
  return settingsRegistry.find((d) => d.key === key);
}

export async function listSettingValues(ctx: ServiceContext) {
  assertCan(ctx.actor, 'admin.setting.view');
  const reader = createSettingsReader(ctx.db);
  return Promise.all(
    settingsRegistry.map(async (definition) => ({
      key: definition.key,
      scope: definition.scope,
      defaultValue: definition.defaultValue,
      value: await reader.get(definition),
    })),
  );
}

export async function changeSetting(
  ctx: ServiceContext,
  input: { key: string; value: unknown; branchId?: string | null; reason?: string | null },
): Promise<Result<unknown>> {
  assertCan(ctx.actor, 'admin.setting.manage');
  const definition = findSettingDefinition(input.key);
  if (!definition) return err('SETTING_UNKNOWN', { key: input.key });
  return updateSetting(ctx.db, definition, {
    value: input.value,
    branchId: input.branchId ?? null,
    actor: auditActor(ctx),
    reason: input.reason ?? null,
  });
}
