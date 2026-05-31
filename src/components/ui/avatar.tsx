'use client';

import { useMemo, useState } from 'react';

import { cn } from '@/lib/cn';

export function Avatar({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string | null;
  alt: string;
  fallback?: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const fallbackText = useMemo(() => {
    const source = fallback || alt || '?';
    return source.trim().slice(0, 1).toUpperCase() || '?';
  }, [alt, fallback]);

  if (!src || errored) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600',
          className,
        )}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className={cn('rounded-full object-cover', className)}
    />
  );
}
