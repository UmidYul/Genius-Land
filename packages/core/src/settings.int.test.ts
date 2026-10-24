import { prisma } from '@gl/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, setupWorld, type TestWorld } from './testing/fixtures';
import { z } from 'zod';
import { writeAudit } from './audit';
import { createSettingsReader, defineSetting, updateSetting } from './settings';

const backdateDays = defineSetting({
  key: 'test.backdateDays',
  schema: z.number().int().min(0),
  defaultValue: 7,
  scope: 'branch',
});

const schoolName = defineSetting({
  key: 'test.globalOnly',
  schema: z.string().min(1),
  defaultValue: 'default',
  scope: 'global',
});

let world: TestWorld;
let actor: { actorId: string; ip: string };

beforeEach(async () => {
  world = await setupWorld();
  actor = { actorId: (await createUser()).id, ip: '127.0.0.1' };
});

describe('settings', () => {
  it('falls back to the default when nothing is stored', async () => {
    expect(await createSettingsReader(prisma).get(backdateDays)).toBe(7);
  });

  it('branch value overrides global, global overrides default', async () => {
    const { branchA, branchB } = world;
    expect((await updateSetting(prisma, backdateDays, { value: 5, actor })).ok).toBe(true);
    expect(
      (await updateSetting(prisma, backdateDays, { value: 3, branchId: branchA, actor })).ok,
    ).toBe(true);

    const reader = createSettingsReader(prisma);
    expect(await reader.get(backdateDays)).toBe(5);
    expect(await reader.get(backdateDays, { branchId: branchA })).toBe(3);
    expect(await reader.get(backdateDays, { branchId: branchB })).toBe(5);
  });

  it('caches per reader: a new reader sees new values', async () => {
    const reader = createSettingsReader(prisma);
    expect(await reader.get(backdateDays)).toBe(7);
    await updateSetting(prisma, backdateDays, { value: 10, actor });
    expect(await reader.get(backdateDays)).toBe(7);
    expect(await createSettingsReader(prisma).get(backdateDays)).toBe(10);
  });

  it('a second global write updates the same row (NULL branch is unique)', async () => {
    await updateSetting(prisma, backdateDays, { value: 1, actor });
    await updateSetting(prisma, backdateDays, { value: 2, actor });
    expect(await prisma.setting.count({ where: { key: backdateDays.key } })).toBe(1);
  });

  it('the database itself rejects a duplicate global row', async () => {
    await prisma.setting.create({ data: { key: 'dup', value: 1 } });
    await expect(prisma.setting.create({ data: { key: 'dup', value: 2 } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('rejects invalid values and a branch for a global setting', async () => {
    expect(await updateSetting(prisma, backdateDays, { value: -1, actor })).toEqual({
      ok: false,
      error: { code: 'SETTING_INVALID', params: { key: 'test.backdateDays' } },
    });
    const res = await updateSetting(prisma, schoolName, {
      value: 'x',
      branchId: world.branchA,
      actor,
    });
    expect(res.ok).toBe(false);
    expect(await prisma.setting.count()).toBe(0);
  });

  it('a corrupted stored value is an error, not a silent default', async () => {
    await prisma.setting.create({ data: { key: backdateDays.key, value: 'seven' } });
    await expect(createSettingsReader(prisma).get(backdateDays)).rejects.toMatchObject({
      code: 'SETTING_INVALID',
    });
  });

  it('every change writes an audit record with before/after and reason', async () => {
    await updateSetting(prisma, backdateDays, { value: 4, actor, reason: 'test' });
    await updateSetting(prisma, backdateDays, { value: 6, actor });
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      actorId: actor.actorId,
      ip: '127.0.0.1',
      action: 'settings.setting.update',
      entityType: 'Setting',
      entityId: 'test.backdateDays',
      before: null,
      after: { value: 4 },
      reason: 'test',
    });
    expect(logs[1]).toMatchObject({ before: { value: 4 }, after: { value: 6 } });
  });
});

describe('writeAudit', () => {
  it('stores money as strings and a system actor as null', async () => {
    const row = await writeAudit(
      prisma,
      { actorId: null },
      { action: 'test.thing.do', entityType: 'Thing', after: { amount: 3_000_000n } },
    );
    expect(row).toMatchObject({ actorId: null, after: { amount: '3000000' }, before: null });
  });

  it('records cannot be changed or deleted', async () => {
    const row = await writeAudit(prisma, actor, { action: 'test.thing.do', entityType: 'Thing' });
    await expect(
      prisma.auditLog.update({ where: { id: row.id }, data: { reason: 'edited' } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
  });

  it('is rolled back together with the change it describes', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await writeAudit(tx, actor, { action: 'test.thing.do', entityType: 'Thing' });
        throw new Error('change failed');
      }),
    ).rejects.toThrow('change failed');
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
