"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { authClient, googleClientId } from "@/lib/auth-client";
import { SocialButtons, type Provider } from "@/components/social-buttons";
import {
  Alert,
  DevOutboxLink,
  Field,
  KeyIcon,
  LastUsedBadge,
  PasswordInput,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";

type Mode = "sign-in" | "sign-up" | "email-code";

// One Tap should be requested once per page load (React runs effects twice in dev).
let oneTapRequested = false;

const titles: Record<Mode, [string, string]> = {
  "sign-in": ["Welcome back", "Sign in with a provider, a passkey, or your password."],
  "sign-up": ["Create your account", "Use a provider, or sign up with email."],
  "email-code": ["Sign in with email", "No password needed. We'll email you a code or a link."],
};

export function AuthCard({
  providers,
  initialMode,
  initialError,
}: {
  providers: Provider[];
  initialMode: "sign-in" | "sign-up";
  initialError?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState<string | undefined>(initialError);

  const goToDashboard = () => {
    router.push("/dashboard");
    router.refresh();
  };

  // Google One Tap: the small "Continue as …" prompt in the corner.
  useEffect(() => {
    if (!googleClientId || !providers.includes("google") || oneTapRequested) return;
    oneTapRequested = true;
    void authClient.oneTap({
      fetchOptions: { onSuccess: goToDashboard },
    });
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(undefined);
    if (next !== "email-code") window.history.replaceState(null, "", next === "sign-up" ? "/?mode=sign-up" : "/");
  }

  const [title, subtitle] = titles[mode];

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>

      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}

        {mode === "email-code" ? (
          <EmailCodeForm onError={setError} onSuccess={goToDashboard} />
        ) : (
          <>
            <SocialButtons providers={providers} hideEmptyNotice />
            {mode === "sign-in" && <PasskeyButton onError={setError} onSuccess={goToDashboard} />}
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              or
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            {mode === "sign-in" ? (
              <SignInForm onError={setError} onSuccess={goToDashboard} />
            ) : (
              <SignUpForm onError={setError} />
            )}
          </>
        )}

        {mode === "sign-in" && (
          <button
            type="button"
            onClick={() => switchMode("email-code")}
            className="relative text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Email me a sign-in code instead
            <LastUsedBadge method={["email-otp", "magic-link"]} className="ml-2 align-middle" />
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        {mode === "sign-up" ? "Already have an account? " : mode === "sign-in" ? "New here? " : ""}
        <button
          type="button"
          onClick={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          {mode === "sign-in" ? "Create an account" : mode === "sign-up" ? "Sign in" : "← Other ways to sign in"}
        </button>
      </p>
    </div>
  );
}

function PasskeyButton({ onError, onSuccess }: { onError: (msg?: string) => void; onSuccess: () => void }) {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    onError(undefined);
    const { error } = await authClient.signIn.passkey();
    setPending(false);
    if (error) {
      // Closing the browser's passkey sheet isn't an error worth showing.
      if (!/cancel|abort|not allowed/i.test(error.message ?? "")) onError(error.message ?? "Passkey sign-in failed.");
      return;
    }
    onSuccess();
  }

  return (
    <button type="button" onClick={signIn} disabled={pending} className={`relative ${secondaryButtonClass} h-12 rounded-full!`}>
      <KeyIcon />
      {pending ? "Waiting for passkey…" : "Sign in with a passkey"}
      <LastUsedBadge method="passkey" />
    </button>
  );
}

function SignInForm({ onError, onSuccess }: { onError: (msg?: string) => void; onSuccess: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [pending, setPending] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  // Passkey autofill: if the browser supports it, saved passkeys appear in the
  // username field's suggestions. Picking one signs you straight in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof PublicKeyCredential === "undefined" || !PublicKeyCredential.isConditionalMediationAvailable) return;
      if (!(await PublicKeyCredential.isConditionalMediationAvailable()) || cancelled) return;
      void authClient.signIn.passkey({ autoFill: true, fetchOptions: { onSuccess } });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    onError(undefined);
    setNeedsVerification(false);

    const id = identifier.trim();
    const { data, error } = id.includes("@")
      ? await authClient.signIn.email({ email: id, password, rememberMe, callbackURL: "/dashboard" })
      : await authClient.signIn.username({ username: id, password, rememberMe, callbackURL: "/dashboard" });

    if (error) {
      setPending(false);
      if (error.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
      else if (error.status === 429) onError("Too many attempts. Wait a minute and try again.");
      else onError(error.message ?? "Couldn't sign you in.");
      return;
    }
    // 2FA accounts: the client plugin is already redirecting to /two-factor.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Email or username" aside={<LastUsedBadge method={["email", "username"]} className="" />}>
        <input
          className={inputClass}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username webauthn"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <Field
        label="Password"
        aside={
          <Link href="/forgot-password" className="text-xs font-normal text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Forgot password?
          </Link>
        }
      >
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
        Keep me signed in
      </label>
      {needsVerification && (
        <Alert tone="info">
          Please verify your email first. We&apos;ve sent you a new link. <DevOutboxLink />
        </Alert>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function EmailCodeForm({ onError, onSuccess }: { onError: (msg?: string) => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"email" | "code" | "link-sent">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"code" | "link" | "verify" | null>(null);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setPending("code");
    onError(undefined);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setPending(null);
    if (error) return onError(error.status === 429 ? "Too many requests. Wait a minute." : (error.message ?? "Couldn't send the code."));
    setCode("");
    setStep("code");
  }

  async function sendLink() {
    if (!email.trim()) return onError("Enter your email first.");
    setPending("link");
    onError(undefined);
    const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: "/dashboard", errorCallbackURL: "/" });
    setPending(null);
    if (error) return onError(error.status === 429 ? "Too many requests. Wait a minute." : (error.message ?? "Couldn't send the link."));
    setStep("link-sent");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setPending("verify");
    onError(undefined);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    setPending(null);
    if (error) return onError(error.message ?? "That code didn't work.");
    onSuccess();
  }

  if (step === "link-sent") {
    return (
      <Alert tone="success">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1">
          We sent a sign-in link to <strong>{email.trim()}</strong>. It works once and expires in 10 minutes. <DevOutboxLink />
        </p>
      </Alert>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We sent a 6-digit code to <strong className="text-zinc-900 dark:text-zinc-100">{email.trim()}</strong>. <DevOutboxLink />
        </p>
        <Field label="Code">
          <input
            className={`${inputClass} text-center font-mono text-xl tracking-[0.5em]`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            placeholder="••••••"
            autoFocus
            required
          />
        </Field>
        <button type="submit" disabled={pending !== null || code.length !== 6} className={primaryButtonClass}>
          {pending === "verify" ? "Checking…" : "Sign in"}
        </button>
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <button type="button" onClick={() => setStep("email")} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Change email
          </button>
          <button type="button" onClick={() => sendCode()} disabled={pending !== null} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {pending === "code" ? "Sending…" : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="flex flex-col gap-4">
      <Field label="Email">
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
      </Field>
      <button type="submit" disabled={pending !== null} className={primaryButtonClass}>
        {pending === "code" ? "Sending…" : "Send me a code"}
      </button>
      <button type="button" onClick={sendLink} disabled={pending !== null} className={secondaryButtonClass}>
        {pending === "link" ? "Sending…" : "Email me a link instead"}
      </button>
      <p className="text-xs text-zinc-500">New here? This creates your account automatically.</p>
    </form>
  );
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

function SignUpForm({ onError }: { onError: (msg?: string) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function checkUsername() {
    const value = username.trim();
    if (!value) return setUsernameStatus("idle");
    if (!USERNAME_RE.test(value)) return setUsernameStatus("invalid");
    setUsernameStatus("checking");
    const { data } = await authClient.isUsernameAvailable({ username: value });
    setUsernameStatus(data?.available ? "available" : "taken");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (usernameStatus === "taken" || usernameStatus === "invalid") return;
    setPending(true);
    onError(undefined);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      password,
      callbackURL: "/dashboard", // where the verification link lands
    });
    setPending(false);
    if (error) return onError(error.message ?? "Couldn't create your account.");
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <Alert tone="success">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1">
          We sent a verification link to <strong>{sentTo}</strong>. Open it to finish creating your account. <DevOutboxLink />
        </p>
      </Alert>
    );
  }

  const usernameHint = {
    idle: "3–30 characters: letters, numbers, _ and .",
    checking: "Checking…",
    available: "✓ Available",
    taken: "That username is taken.",
    invalid: "Use 3–30 letters, numbers, _ or .",
  }[usernameStatus];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Full name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </Field>
      <Field
        label="Username"
        hint={
          <span
            className={
              usernameStatus === "taken" || usernameStatus === "invalid"
                ? "text-red-600 dark:text-red-400"
                : usernameStatus === "available"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : ""
            }
          >
            {usernameHint}
          </span>
        }
      >
        <input
          className={inputClass}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setUsernameStatus("idle");
          }}
          onBlur={checkUsername}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <Field label="Email">
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>
      <Field label="Password" hint={<PasswordStrength password={password} />}>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
      </Field>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return <>At least 8 characters. Passwords found in data breaches are rejected.</>;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length < 8) score = Math.min(score, 1);
  const s = [
    { bars: 1, label: "Too weak", color: "bg-red-500" },
    { bars: 1, label: "Weak", color: "bg-red-500" },
    { bars: 2, label: "Fair", color: "bg-amber-500" },
    { bars: 3, label: "Good", color: "bg-emerald-500" },
    { bars: 4, label: "Strong", color: "bg-emerald-500" },
  ][score];
  return (
    <span className="flex items-center gap-2">
      <span className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < s.bars ? s.color : "bg-zinc-200 dark:bg-zinc-800"}`} />
        ))}
      </span>
      {s.label}
    </span>
  );
}
