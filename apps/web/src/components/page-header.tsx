import type { ReactNode } from 'react';

export function PageHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-1.5">
      <h1 className="font-head text-fg text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {title}
      </h1>
      {description && <p className="text-fg-muted text-[0.9375rem]">{description}</p>}
    </div>
  );
}
