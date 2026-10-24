import 'server-only';
import { createSettingsReader } from '@gl/core';
import { prisma } from '@gl/db';
import { cache } from 'react';

/**
 * Settings reader for the current request. React `cache` gives one reader per server request,
 * so a setting is read from the database at most once per request and never goes stale.
 */
export const getSettings = cache(() => createSettingsReader(prisma));
