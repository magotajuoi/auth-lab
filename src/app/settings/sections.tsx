"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import QRCode from "react-qr-code";
import { authClient } from "@/lib/auth-client";
import { PasswordStrength } from "@/components/auth-card";
import { providerIcons, providerLabels, type Provider } from "@/components/social-buttons";
import {
  Alert,
  DevOutboxLink,
  Field,
  KeyIcon,
  PasswordInput,
  dangerButtonClass,
  inputClass,
  smallButtonClass,
} from "@/components/ui";
import { setPasswordAction } from "./actions";

type Status = { tone: "error" | "success" | "info"; text: ReactNode } | null;

function Section({ title, description, children, tone }: { title: string; description?: string; children: ReactNode; tone?: "danger" }) {
  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 ${
        tone === "danger" ? "border-red-200 dark:border-red-900/60" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  return status ? <Alert tone={status.tone}>{status.text}</Alert> : null;
}

// Server (Node) and browser can format dates differently, so let the browser's
// version win without a hydration error.
function LocalDate({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}

const isLocalAddress = (ip: string) => ip === "::1" || ip === "127.0.0.1" || /^[0:]+$/.test(ip) || ip === "::ffff:127.0.0.1";

/* ───────────────────────── Profile ───────────────────────── */

export function ProfileSection({ name: initialName, username: initialUsername }: { name: string; username: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const changes: { name?: string; username?: string } = {};
    if (name.trim() !== initialName) changes.name = name.trim();
    if (username.trim() && username.trim() !== initialUsername) changes.username = username.trim();
    const { error } = await authClient.updateUser(changes);
    setPending(false);
    if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't save." });
    setStatus({ tone: "success", text: "Saved." });
    router.refresh();
  }

  const unchanged = name.trim() === initialName && username.trim() === initialUsername;

  return (
    <Section title="Profile">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <StatusLine status={status} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
          <Field label="Username" hint="Letters, numbers, _ and . (3–30)">
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Pick a username"
            />
          </Field>
        </div>
        <div>
          <button type="submit" disabled={pending || unchanged} className={smallButtonClass}>
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </Section>
  );
}

/* ───────────────────────── Password ───────────────────────── */

export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const result = hasPassword
      ? await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: signOutOthers })
      : await setPasswordAction(next);
    setPending(false);
    const message = "error" in result && result.error ? (typeof result.error === "string" ? result.error : result.error.message) : null;
    if (message !== null) return setStatus({ tone: "error", text: message ?? "Couldn't update your password." });
    setCurrent("");
    setNext("");
    setStatus({
      tone: "success",
      text: hasPassword ? "Password changed." : "Password set. You can now sign in with your email or username and this password.",
    });
    router.refresh();
  }

  return (
    <Section
      title="Password"
      description={
        hasPassword
          ? "Change the password you use with your email or username."
          : "You don't have a password yet. Add one to also sign in with your email or username."
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <StatusLine status={status} />
        <div className="grid gap-4 sm:grid-cols-2">
          {hasPassword && (
            <Field label="Current password">
              <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
            </Field>
          )}
          <Field label={hasPassword ? "New password" : "Password"} hint={<PasswordStrength password={next} />}>
            <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
          </Field>
        </div>
        {hasPassword && (
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
            Sign out of all other devices
          </label>
        )}
        <div>
          <button type="submit" disabled={pending} className={smallButtonClass}>
            {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
          </button>
        </div>
      </form>
    </Section>
  );
}

/* ───────────────────────── Passkeys ───────────────────────── */

type PasskeyRow = { id: string; name: string; createdAt: string; synced: boolean };

function guessDeviceName() {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Mac/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows PC" : "This device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${device} (${browser})` : device;
}

export function PasskeysSection({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  async function add() {
    setPending("add");
    setStatus(null);
    const result = await authClient.passkey.addPasskey({ name: guessDeviceName() });
    setPending(null);
    if (result?.error) {
      if (/cancel|abort|not allowed/i.test(result.error.message ?? "")) return;
      return setStatus({ tone: "error", text: result.error.message ?? "Couldn't add the passkey." });
    }
    setStatus({ tone: "success", text: "Passkey added. Next time, choose “Sign in with a passkey”." });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this passkey? You won't be able to sign in with it any more.")) return;
    setPending(id);
    setStatus(null);
    const { error } = await authClient.passkey.deletePasskey({ id });
    setPending(null);
    if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't remove the passkey." });
    router.refresh();
  }

  async function rename(id: string, current: string) {
    const name = prompt("Name this passkey", current)?.trim();
    if (!name || name === current) return;
    setPending(id);
    const { error } = await authClient.passkey.updatePasskey({ id, name });
    setPending(null);
    if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't rename the passkey." });
    router.refresh();
  }

  return (
    <Section
      title="Passkeys"
      description="Sign in with Face ID, Touch ID, Windows Hello or a security key instead of a password. Passkeys can't be phished or leaked."
    >
      <StatusLine status={status} />
      {passkeys.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {passkeys.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3">
                <KeyIcon />
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-zinc-500">
                    Added <LocalDate iso={p.createdAt} />
                    {p.synced && " · Synced across your devices"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => rename(p.id, p.name)} disabled={pending !== null} className={smallButtonClass}>
                  Rename
                </button>
                <button type="button" onClick={() => remove(p.id)} disabled={pending !== null} className={smallButtonClass}>
                  {pending === p.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button type="button" onClick={add} disabled={pending !== null} className={smallButtonClass}>
          <KeyIcon />
          {pending === "add" ? "Follow your browser's prompt…" : "Add a passkey"}
        </button>
      </div>
    </Section>
  );
}

/* ───────────────────────── Two-factor ───────────────────────── */

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Save your backup codes</p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
        If you lose your phone, each code lets you sign in once. They won&apos;t be shown again.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={smallButtonClass}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a className={smallButtonClass} href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="auth-lab-backup-codes.txt">
          Download
        </a>
      </div>
    </div>
  );
}

export function TwoFactorSection({
  enabled,
  hasAuthenticator,
  hasPassword,
}: {
  enabled: boolean;
  hasAuthenticator: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "password" | "scan" | "done">("idle");
  const [action, setAction] = useState<"enable" | "email" | "disable" | "codes">("enable");
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const secret = totpURI ? (new URL(totpURI).searchParams.get("secret") ?? "") : "";
  const pw = hasPassword ? { password } : {};

  function start(next: "enable" | "email" | "disable" | "codes") {
    setAction(next);
    setStatus(null);
    setPassword("");
    if (hasPassword) setStep("password");
    else void run(next);
  }

  async function run(which = action) {
    setPending(true);
    setStatus(null);
    if (which === "email") {
      const { error } = await authClient.twoFactor.enable({ ...(pw as { password: string }), method: "otp" });
      setPending(false);
      if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't turn on email codes." });
      setStep("idle");
      setStatus({ tone: "success", text: "Two-factor authentication is on. After your password, we'll email you a 6-digit code." });
      router.refresh();
    } else if (which === "enable") {
      const { data, error } = await authClient.twoFactor.enable({ ...(pw as { password: string }), method: "totp" });
      setPending(false);
      if (error || data.method !== "totp") return setStatus({ tone: "error", text: error?.message ?? "Couldn't start 2FA setup." });
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes);
      setCode("");
      setKeyCopied(false);
      setStep("scan");
    } else if (which === "disable") {
      const { error } = await authClient.twoFactor.disable(pw as { password: string });
      setPending(false);
      if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't turn off 2FA." });
      setStep("idle");
      setStatus({ tone: "success", text: "Two-factor authentication is off." });
      router.refresh();
    } else {
      const { data, error } = await authClient.twoFactor.generateBackupCodes(pw as { password: string });
      setPending(false);
      if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't create new codes." });
      setBackupCodes(data.backupCodes);
      setStep("done");
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (error)
      return setStatus({
        tone: "error",
        text: "That code didn't match. Wait for the next code and try again, and check your phone's clock is set automatically.",
      });
    setStep("done");
    router.refresh();
  }

  return (
    <Section
      title="Two-factor authentication"
      description="After your password, also ask for a 6-digit code: emailed to you, or from an authenticator app (Google Authenticator, iPhone Passwords, 1Password…)."
    >
      <StatusLine status={status} />

      {step === "idle" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                enabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {enabled ? "On" : "Off"}
            </span>
            {enabled && (
              <span className="text-zinc-600 dark:text-zinc-400">
                {hasAuthenticator ? "Authenticator app, with email codes as a fallback" : "Codes sent to your email"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!enabled && (
              <button type="button" onClick={() => start("email")} disabled={pending} className={smallButtonClass}>
                {pending && action === "email" ? "Turning on…" : "Email me codes"}
              </button>
            )}
            {!hasAuthenticator && (
              <button type="button" onClick={() => start("enable")} disabled={pending} className={smallButtonClass}>
                {pending && action === "enable" ? "Starting…" : enabled ? "Add an authenticator app" : "Use an authenticator app"}
              </button>
            )}
            {hasAuthenticator && (
              <button type="button" onClick={() => start("codes")} disabled={pending} className={smallButtonClass}>
                New backup codes
              </button>
            )}
            {enabled && (
              <button type="button" onClick={() => start("disable")} disabled={pending} className={smallButtonClass}>
                Turn off
              </button>
            )}
          </div>
        </div>
      )}

      {step === "password" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
          className="flex flex-col gap-3 sm:max-w-sm"
        >
          <Field label="Confirm your password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
          </Field>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={smallButtonClass}>
              {pending ? "Checking…" : "Continue"}
            </button>
            <button type="button" onClick={() => setStep("idle")} className={smallButtonClass}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === "scan" && (
        <div className="flex flex-col gap-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              Add auth-lab to an authenticator app: scan the QR code with your phone, or on the phone itself tap{" "}
              <strong>Open in authenticator app</strong>.
            </li>
            <li>Type the 6-digit code the app shows below to finish.</li>
          </ol>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div className="rounded-xl bg-white p-3">
              <QRCode value={totpURI} size={200} />
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <a href={totpURI} className={smallButtonClass}>
                Open in authenticator app
              </a>
              <div>
                <p className="text-zinc-600 dark:text-zinc-400">Or enter this setup key manually (time-based, 6 digits):</p>
                <code className="mt-1 block font-mono text-sm break-all">{secret.match(/.{1,4}/g)?.join(" ")}</code>
                <button
                  type="button"
                  className={`${smallButtonClass} mt-2`}
                  onClick={async () => {
                    await navigator.clipboard.writeText(secret);
                    setKeyCopied(true);
                  }}
                >
                  {keyCopied ? "Key copied" : "Copy key"}
                </button>
              </div>
              <details className="text-zinc-600 dark:text-zinc-400">
                <summary className="cursor-pointer">Using an iPhone?</summary>
                <p className="mt-2 max-w-sm">
                  Scanning with the Camera opens the <strong>Passwords</strong> app, which attaches the code to a saved
                  password. If it asks you to pick one, choose <strong>New Password</strong>, set the website to{" "}
                  <code>localhost</code>, save, then tap <strong>Set Up Verification Code</strong> and scan again (or
                  paste the key). Google Authenticator or Microsoft Authenticator also work and skip this step.
                </p>
              </details>
            </div>
          </div>
          <form onSubmit={verify} className="flex flex-col gap-3 sm:max-w-xs">
            <Field label="Code from the app">
              <input
                className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={pending || code.length !== 6} className={smallButtonClass}>
                {pending ? "Verifying…" : "Verify and turn on"}
              </button>
              <button type="button" onClick={() => setStep("idle")} className={smallButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col gap-4">
          {action === "enable" && <Alert tone="success">Two-factor authentication is on.</Alert>}
          <BackupCodes codes={backupCodes} />
          <div>
            <button type="button" onClick={() => setStep("idle")} className={smallButtonClass}>
              I&apos;ve saved them
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ───────────────────────── Connected accounts ───────────────────────── */

export function ConnectedAccountsSection({
  providers,
  linked,
  totalMethods,
}: {
  providers: Provider[];
  linked: { providerId: string; accountId: string }[];
  totalMethods: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  if (providers.length === 0) return null;

  async function connect(provider: Provider) {
    setPending(provider);
    setStatus(null);
    const { error } = await authClient.linkSocial({ provider, callbackURL: "/settings", errorCallbackURL: "/settings" });
    if (error) {
      setPending(null);
      setStatus({ tone: "error", text: error.message ?? "Couldn't connect." });
    }
  }

  async function disconnect(provider: Provider, accountId: string) {
    if (!confirm(`Disconnect ${providerLabels[provider]}? You won't be able to sign in with it until you connect it again.`)) return;
    setPending(provider);
    setStatus(null);
    const { error } = await authClient.unlinkAccount({ accountId });
    setPending(null);
    if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't disconnect." });
    router.refresh();
  }

  return (
    <Section title="Connected accounts" description="Sign in with any of these. They all lead to this same account.">
      <StatusLine status={status} />
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {providers.map((provider) => {
          const Icon = providerIcons[provider];
          const account = linked.find((a) => a.providerId === provider);
          const isLinked = !!account;
          const lastMethod = isLinked && totalMethods <= 1;
          return (
            <li key={provider} className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3">
                <Icon />
                <div>
                  <p className="text-sm font-medium">{providerLabels[provider]}</p>
                  <p className="text-xs text-zinc-500">{isLinked ? "Connected" : "Not connected"}</p>
                </div>
              </div>
              {isLinked ? (
                <button
                  type="button"
                  onClick={() => account && disconnect(provider, account.accountId)}
                  disabled={pending !== null || lastMethod}
                  title={lastMethod ? "Add a password or passkey first, so you can still sign in." : undefined}
                  className={smallButtonClass}
                >
                  {pending === provider ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : (
                <button type="button" onClick={() => connect(provider)} disabled={pending !== null} className={smallButtonClass}>
                  {pending === provider ? "Redirecting…" : "Connect"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ───────────────────────── Sessions ───────────────────────── */

type SessionRow = { token: string; device: string; ip: string; createdAt: string; updatedAt: string };

export function SessionsSection({ sessions, currentToken }: { sessions: SessionRow[]; currentToken: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const sorted = [...sessions].sort((a, b) => (a.token === currentToken ? -1 : b.token === currentToken ? 1 : b.updatedAt.localeCompare(a.updatedAt)));
  const others = sessions.filter((s) => s.token !== currentToken).length;

  async function revoke(token: string) {
    setPending(token);
    setStatus(null);
    const { error } = await authClient.revokeSession({ token });
    setPending(null);
    if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't sign that device out." });
    router.refresh();
  }

  async function revokeOthers() {
    setPending("others");
    setStatus(null);
    const { error } = await authClient.revokeOtherSessions();
    setPending(null);
    if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't sign the other devices out." });
    setStatus({ tone: "success", text: "Signed out of all other devices." });
    router.refresh();
  }

  return (
    <Section title="Where you're signed in" description="If you don't recognise a device, sign it out and change your password.">
      <StatusLine status={status} />
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {sorted.map((s) => (
          <li key={s.token} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="text-sm font-medium">
                {s.device}
                {s.token === currentToken && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    This device
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                Signed in <LocalDate iso={s.createdAt} />
                {s.ip && ` · ${isLocalAddress(s.ip) ? "localhost" : s.ip}`}
              </p>
            </div>
            {s.token !== currentToken && (
              <button type="button" onClick={() => revoke(s.token)} disabled={pending !== null} className={smallButtonClass}>
                {pending === s.token ? "Signing out…" : "Sign out"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 && (
        <div>
          <button type="button" onClick={revokeOthers} disabled={pending !== null} className={smallButtonClass}>
            {pending === "others" ? "Signing out…" : `Sign out of ${others} other ${others === 1 ? "device" : "devices"}`}
          </button>
        </div>
      )}
    </Section>
  );
}

/* ───────────────────────── Danger zone ───────────────────────── */

export function DangerZoneSection({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const { error } = await authClient.deleteUser({ ...(hasPassword ? { password } : {}), callbackURL: "/?deleted=1" });
    setPending(false);
    if (error) return setStatus({ tone: "error", text: error.message ?? "Couldn't start account deletion." });
    setOpen(false);
    setStatus({
      tone: "info",
      text: (
        <>
          We emailed you a confirmation link. Your account is deleted only when you open it. <DevOutboxLink />
        </>
      ),
    });
  }

  return (
    <Section tone="danger" title="Delete account" description="Permanently delete your account, sign-in methods and sessions. This can't be undone.">
      <StatusLine status={status} />
      {open ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:max-w-sm">
          {hasPassword && (
            <Field label="Confirm your password">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
            </Field>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={dangerButtonClass}>
              {pending ? "Sending…" : "Email me a confirmation link"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={smallButtonClass}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button type="button" onClick={() => setOpen(true)} className={dangerButtonClass}>
            Delete my account
          </button>
        </div>
      )}
    </Section>
  );
}
