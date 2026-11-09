"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, DevOutboxLink, Field, inputClass, primaryButtonClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const { error } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setPending(false);
    if (error) return setError(error.message ?? "Something went wrong.");
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
        {sent ? (
          // Same message whether or not the account exists, so this page can't be used to probe emails.
          <Alert tone="success">
            If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. It expires in 1 hour. <DevOutboxLink />
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Email">
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </Field>
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
