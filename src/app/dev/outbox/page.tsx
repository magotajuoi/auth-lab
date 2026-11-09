import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionsSkeleton } from "@/components/skeletons";
import { connection } from "next/server";
import { outbox } from "@/lib/mailer";

function buttonLabel(subject: string) {
  if (subject.startsWith("Verify")) return "Verify email";
  if (subject.startsWith("Reset")) return "Reset password";
  if (subject.startsWith("Confirm account")) return "Delete my account";
  return "Sign in";
}

// Local testing only: shows the emails the app "sent" (verification, password reset).
// Request-time reads (session, search params) happen inside <Suspense>: the
// Cache Components pattern, so the page shell can render before they resolve.

export const metadata: Metadata = { title: "Dev inbox" };

export default function OutboxPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-12"><SectionsSkeleton count={2} /></main>}>
      <Outbox />
    </Suspense>
  );
}

async function Outbox() {
  if (process.env.NODE_ENV === "production") notFound();
  await connection(); // always render fresh

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Dev inbox</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Emails the app would have sent. Nothing leaves your machine. Refresh to see new ones. This clears when the dev server restarts.
      </p>
      {outbox.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">No emails yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {outbox.map((m) => (
            <li key={m.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{m.subject}</p>
                <time className="text-xs text-zinc-500">{m.sentAt.toLocaleTimeString()}</time>
              </div>
              <p className="text-sm text-zinc-500">To: {m.to}</p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{m.text}</p>
              {m.code && (
                <p className="mt-3 inline-block rounded-lg bg-zinc-100 px-4 py-2 font-mono text-2xl tracking-[0.3em] dark:bg-zinc-800">{m.code}</p>
              )}
              {m.url && (
                <a href={m.url} className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                  {buttonLabel(m.subject)}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
