import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionsSkeleton } from "@/components/skeletons";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, enabledProviders } from "@/lib/auth";
import { describeUserAgent } from "@/lib/user-agent";
import {
  ConnectedAccountsSection,
  DangerZoneSection,
  PasskeysSection,
  PasswordSection,
  ProfileSection,
  SessionsSection,
  TwoFactorSection,
} from "./sections";

// Request-time reads (session, search params) happen inside <Suspense>: the
// Cache Components pattern, so the page shell can render before they resolve.

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12"><SectionsSkeleton count={4} /></main>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect("/");

  const [accounts, sessions, passkeys] = await Promise.all([
    auth.api.listUserAccounts({ headers: requestHeaders }),
    auth.api.listSessions({ headers: requestHeaders }),
    auth.api.listPasskeys({ headers: requestHeaders }),
  ]);
  const { user } = session;
  const hasPassword = accounts.some((a) => a.providerId === "credential");
  // Is an authenticator app set up and confirmed? (Email-code 2FA has no record here.)
  const ctx = await auth.$context;
  const totp = await ctx.adapter.findOne<{ verified?: boolean | null }>({
    model: "twoFactor",
    where: [{ field: "userId", value: user.id }],
  });
  const hasAuthenticator = !!totp && totp.verified !== false;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          ← Dashboard
        </Link>
      </header>

      <ProfileSection name={user.name} username={user.displayUsername || user.username || ""} />
      <PasswordSection hasPassword={hasPassword} />
      <PasskeysSection
        passkeys={passkeys.map((p) => ({
          id: p.id,
          name: p.name ?? "Passkey",
          createdAt: new Date(p.createdAt).toISOString(),
          synced: p.backedUp,
        }))}
      />
      <TwoFactorSection enabled={!!user.twoFactorEnabled} hasAuthenticator={hasAuthenticator} hasPassword={hasPassword} />
      <ConnectedAccountsSection
        providers={enabledProviders}
        linked={accounts
          .filter((a) => a.providerId !== "credential")
          .map((a) => ({ providerId: a.providerId, accountId: a.accountId }))}
        totalMethods={accounts.length + passkeys.length}
      />
      <SessionsSection
        currentToken={session.session.token}
        sessions={sessions.map((s) => ({
          token: s.token,
          device: describeUserAgent(s.userAgent),
          ip: s.ipAddress ?? "",
          createdAt: new Date(s.createdAt).toISOString(),
          updatedAt: new Date(s.updatedAt).toISOString(),
        }))}
      />
      <DangerZoneSection hasPassword={hasPassword} />
    </main>
  );
}
