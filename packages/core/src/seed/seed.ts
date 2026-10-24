import type { PrismaClient } from '@gl/db';
import { roleDefinitions, type RoleCode } from '../access/roles';
import { syncAccessModel } from '../access/sync';
import { hashPassword } from '../auth/password';

/**
 * Branches as named by Umid (PLAN §6 Q1). Names can be changed later by the superadmin;
 * the code is permanent.
 */
export const seedBranches = [
  {
    code: 'main',
    nameUz: 'Asosiy',
    nameRu: 'Основной',
    address: '74A Orolboyi Street, Margilan, Fergana Region',
  },
  {
    code: 'filial',
    nameUz: 'Filial',
    nameRu: 'Филиал',
    address: '79G Burkhoniddin Margiloniy Street, Miltiqsoz Makhalla, Margilan',
  },
] as const;

/** Password of every demo staff account. Demo data only — never used outside development. */
export const DEMO_PASSWORD = 'demo12345';

interface DemoUser {
  phone: string;
  fullName: string;
  role: RoleCode;
  branches: ('main' | 'filial')[];
  staff: boolean;
}

/**
 * One clearly marked demo user per role. Phones use the non-existent operator code 00, so they
 * can never reach a real person.
 */
export const demoUsers: DemoUser[] = [
  {
    phone: '+998000000001',
    fullName: 'Суперадмин (демо)',
    role: 'SUPERADMIN',
    branches: [],
    staff: true,
  },
  {
    phone: '+998000000002',
    fullName: 'Основатель (демо)',
    role: 'FOUNDER',
    branches: [],
    staff: true,
  },
  {
    phone: '+998000000003',
    fullName: 'Директор основного (демо)',
    role: 'DIRECTOR',
    branches: ['main'],
    staff: true,
  },
  {
    phone: '+998000000004',
    fullName: 'Директор филиала (демо)',
    role: 'DIRECTOR',
    branches: ['filial'],
    staff: true,
  },
  {
    phone: '+998000000005',
    fullName: 'Администратор (демо)',
    role: 'ADMINISTRATOR',
    branches: ['main'],
    staff: true,
  },
  {
    phone: '+998000000006',
    fullName: 'Учитель (демо)',
    role: 'TEACHER',
    branches: ['main'],
    staff: true,
  },
  {
    phone: '+998000000007',
    fullName: 'Бухгалтер (демо)',
    role: 'ACCOUNTANT',
    branches: ['main', 'filial'],
    staff: true,
  },
  {
    phone: '+998000000008',
    fullName: 'Родитель (демо)',
    role: 'PARENT',
    branches: [],
    staff: false,
  },
  {
    phone: '+998000000009',
    fullName: 'Ученик (демо)',
    role: 'STUDENT',
    branches: [],
    staff: false,
  },
];

/** Directions named in PRODUCT.md. The list is editable in the interface. */
export const seedDirections = [
  { nameRu: 'Экономика', nameUz: 'Iqtisodiyot' },
  { nameRu: 'Медицина', nameUz: 'Tibbiyot' },
  { nameRu: 'Филология', nameUz: 'Filologiya' },
];

export async function seedCatalog(db: PrismaClient) {
  for (const direction of seedDirections) {
    await db.direction.upsert({
      where: { nameRu: direction.nameRu },
      create: direction,
      update: {},
    });
  }
}

export async function seedBranchesAndAccess(db: PrismaClient) {
  await syncAccessModel(db);
  for (const branch of seedBranches) {
    // Existing branches keep their (possibly renamed) names.
    await db.branch.upsert({ where: { code: branch.code }, create: branch, update: {} });
  }
}

export async function seedDemoUsers(db: PrismaClient) {
  const branches = await db.branch.findMany();
  const roles = await db.role.findMany();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const demo of demoUsers) {
    const role = roles.find((r) => r.code === demo.role);
    if (!role) throw new Error(`Role ${demo.role} missing — run syncAccessModel first`);
    const user = await db.user.upsert({
      where: { phone: demo.phone },
      create: {
        phone: demo.phone,
        fullName: demo.fullName,
        locale: 'ru',
        passwordHash: demo.staff ? passwordHash : null,
        channels: { create: { type: 'SMS', address: demo.phone, verifiedAt: new Date() } },
      },
      update: {},
    });
    const existing = await db.roleAssignment.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });
    if (existing) continue;
    const branchIds = roleDefinitions[demo.role].branchBound
      ? branches.filter((b) => (demo.branches as string[]).includes(b.code)).map((b) => b.id)
      : [];
    await db.roleAssignment.create({
      data: {
        userId: user.id,
        roleId: role.id,
        branches: { create: branchIds.map((branchId) => ({ branchId })) },
      },
    });
  }
}
