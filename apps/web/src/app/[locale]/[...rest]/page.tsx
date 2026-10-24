import { notFound } from 'next/navigation';

// Unknown paths under /uz or /ru render the localized not-found page.
export default function CatchAll() {
  notFound();
}
