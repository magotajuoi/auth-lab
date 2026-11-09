import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/skeletons";
import { ResetPasswordForm } from "./reset-password-form";

// Request-time reads (session, search params) happen inside <Suspense>: the
// Cache Components pattern, so the page shell can render before they resolve.

type SearchParams = Promise<{ token?: string; error?: string }>;

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950"><CardSkeleton /></main>}>
      <ResetPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPassword({ searchParams }: { searchParams: SearchParams }) {
  const { token, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        {token && !error ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              This reset link is invalid or has expired.
            </p>
            <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium underline underline-offset-2">
              Request a new link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
