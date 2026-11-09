// Placeholders shown for the instant before session-dependent content streams in.

export function CardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="w-full max-w-sm animate-pulse rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-7 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 h-11 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-11 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function SectionsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-40 rounded-2xl border border-zinc-200 dark:border-zinc-800" />
      ))}
    </div>
  );
}
