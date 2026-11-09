import { headers } from "next/headers";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionsSkeleton } from "@/components/skeletons";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

// Request-time reads (session, search params) happen inside <Suspense>: the
// Cache Components pattern, so the page shell can render before they resolve.

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-16"><SectionsSkeleton count={2} /></main>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect("/");

  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
  const { user } = session;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-16">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-14 w-14 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-xl font-semibold dark:bg-zinc-800">
              {(user.name || user.email)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">{user.name || "Signed in"}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {user.username && <span className="mr-2 font-medium">@{user.displayUsername || user.username}</span>}
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings"
            className="flex h-10 items-center rounded-full border border-zinc-300 px-5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Settings
          </Link>
          <SignOutButton />
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Linked sign-in methods</h2>
        <ul className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-full bg-zinc-100 px-3 py-1 text-sm capitalize dark:bg-zinc-800">
              {a.providerId === "credential" ? "password" : a.providerId}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 text-sm dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Session</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
          <dt>User ID</dt><dd className="font-mono break-all">{user.id}</dd>
          <dt>Two-factor</dt><dd>{user.twoFactorEnabled ? "On" : "Off"}</dd>
          <dt>Email verified</dt><dd>{user.emailVerified ? "Yes" : "No"}</dd>
          <dt>Expires</dt><dd suppressHydrationWarning>{new Date(session.session.expiresAt).toLocaleString()}</dd>
        </dl>
      </section>
    </main>
  );
}
