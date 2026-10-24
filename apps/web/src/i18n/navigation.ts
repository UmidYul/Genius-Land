import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware Link, router and pathname (pathname is returned without the /uz|/ru prefix). */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
