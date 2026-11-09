"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Field, PasswordInput, primaryButtonClass } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The passwords don't match.");
    setPending(true);
    setError(undefined);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) return setError(error.message ?? "Couldn't reset your password.");
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <Alert tone="success">Your password was changed and you were signed out everywhere else.</Alert>
        <Link href="/" className={primaryButtonClass}>Sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="New password" hint="At least 8 characters.">
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
      </Field>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
