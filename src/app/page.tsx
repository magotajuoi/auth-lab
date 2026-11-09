import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, enabledProviders } from "@/lib/auth";
import { AuthCard } from "@/components/auth-card";
import { CardSkeleton } from "@/components/skeletons";

const errorMessages: Record<string, string> = {
  access_denied: "You cancelled the sign-in.",
  account_not_linked:
    "An account with this email already exists but isn't verified yet. Verify it from your inbox, or sign in with your password.",
  invalid_code: "The provider rejected the sign-in code. Check your client secret.",
  state_mismatch: "Your sign-in session expired. Please try again.",
  INVALID_TOKEN: "That sign-in link is invalid or was already used.",
  two_factor_required:
    "This account uses two-factor authentication. Sign in with your password and code, or a passkey.",
  EXPIRED_TOKEN: "That sign-in link has expired. Request a new one.",
};


// Request-time reads (session, search params) happen inside <Suspense>: the
// Cache Components pattern, so the page shell can render before they resolve.

type SearchParams = Promise<{ error?: string; mode?: string; deleted?: string }>;

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <Suspense fallback={<CardSkeleton />}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignIn({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  const { error, mode, deleted } = await searchParams;
  const errorText = error ? (errorMessages[error] ?? `Sign-in didn't complete (${error}). Please try again.`) : undefined;

  return (
    <>
      {deleted && (
        <p role="status" className="w-full max-w-sm rounded-lg bg-zinc-200 p-3 text-center text-sm dark:bg-zinc-800">
          Your account has been deleted.
        </p>
      )}
      <AuthCard providers={enabledProviders} initialMode={mode === "sign-up" ? "sign-up" : "sign-in"} initialError={errorText} />
    </>
  );
}
