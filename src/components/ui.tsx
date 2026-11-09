"use client";

import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export const inputClass =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-[15px] outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-300 dark:focus:ring-zinc-300/10";

export const primaryButtonClass =
  "flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";

export function Field({ label, hint, children, aside }: { label: string; hint?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        {aside}
      </span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export const secondaryButtonClass =
  "flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800";

export const smallButtonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800";

export const dangerButtonClass =
  "inline-flex h-9 items-center justify-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60";

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${inputClass} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    info: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${styles}`}>{children}</div>;
}

export function DevOutboxLink() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <a href="/dev/outbox" target="_blank" className="font-medium underline underline-offset-2">
      Open the dev inbox
    </a>
  );
}

// "Last used" pill, read from the last-login-method cookie after mount
// (reading it during render would differ between server and browser).
export function LastUsedBadge({ method, className = "absolute -top-2 right-3" }: { method: string | string[]; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const methods = Array.isArray(method) ? method : [method];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookie is only readable in the browser
    setShow(methods.some((m) => authClient.isLastUsedLoginMethod(m)));
  }, [method]);
  if (!show) return null;
  return (
    <span className={`${className} rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase`}>
      Last used
    </span>
  );
}

export function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 8.65-8.65M18 5l2 2M15 8l2 2" />
    </svg>
  );
}
