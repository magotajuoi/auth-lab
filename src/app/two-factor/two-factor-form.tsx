"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, DevOutboxLink, Field, inputClass, primaryButtonClass } from "@/components/ui";

export type Method = "totp" | "otp" | "backup";

const copy: Record<Method, { label: string; help: string; switchTo: string }> = {
  totp: { label: "Authentication code", help: "Open your authenticator app and enter the 6-digit code for auth-lab.", switchTo: "Use authenticator app" },
  otp: { label: "Code from your email", help: "We emailed you a 6-digit code. It expires in 5 minutes.", switchTo: "Email me a code" },
  backup: { label: "Backup code", help: "Enter one of the backup codes you saved when you set up 2FA. Each works once.", switchTo: "Use a backup code" },
};

export function TwoFactorForm({ methods }: { methods: Method[] }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(methods[0]);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [pending, setPending] = useState<"verify" | "send" | null>(null);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const autoSent = useRef(false);

  async function sendCode() {
    setPending("send");
    setError(undefined);
    const { error } = await authClient.twoFactor.sendOtp();
    setPending(null);
    if (error) {
      if (error.status === 429) return setError("Too many requests. Wait a minute and try again.");
      return setError(error.status === 401 ? "This sign-in step expired. Go back and enter your password again." : (error.message ?? "Couldn't send the code."));
    }
    setSent(true);
  }

  // Email codes are sent as soon as that method is picked (once per visit).
  useEffect(() => {
    if (method === "otp" && !autoSent.current) {
      autoSent.current = true;
      void sendCode();
    }
  }, [method]);

  function choose(next: Method) {
    setMethod(next);
    setCode("");
    setError(undefined);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending("verify");
    setError(undefined);
    const value = code.trim();
    const { error } =
      method === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: value, trustDevice })
        : method === "otp"
          ? await authClient.twoFactor.verifyOtp({ code: value, trustDevice })
          : await authClient.twoFactor.verifyBackupCode({ code: value, trustDevice });
    setPending(null);
    if (error) {
      if (error.status === 429) return setError("Too many attempts. Wait a minute and try again.");
      if (error.status === 401 && /session|cookie|expired/i.test(error.message ?? ""))
        return setError("This sign-in step expired. Go back and enter your password again.");
      return setError(error.message ?? "That code didn't work.");
    }
    router.push("/dashboard");
    router.refresh();
  }

  const numeric = method !== "backup";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-semibold tracking-tight">Two-factor authentication</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {copy[method].help} {method === "otp" && sent && <DevOutboxLink />}
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label={copy[method].label}>
          <input
            key={method}
            className={`${inputClass} text-center font-mono text-xl ${numeric ? "tracking-[0.5em]" : "tracking-widest"}`}
            value={code}
            onChange={(e) => setCode(numeric ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value)}
            inputMode={numeric ? "numeric" : "text"}
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
          Don&apos;t ask again on this device for 30 days
        </label>
        <button type="submit" disabled={pending !== null} className={primaryButtonClass}>
          {pending === "verify" ? "Verifying…" : "Verify"}
        </button>
        {method === "otp" && (
          <button type="button" onClick={sendCode} disabled={pending !== null} className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {pending === "send" ? "Sending…" : "Resend code"}
          </button>
        )}
      </form>
      <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {methods
          .filter((m) => m !== method)
          .map((m) => (
            <button key={m} type="button" onClick={() => choose(m)} className="text-left hover:text-zinc-900 dark:hover:text-zinc-100">
              {copy[m].switchTo}
            </button>
          ))}
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Cancel
        </Link>
      </div>
    </div>
  );
}
