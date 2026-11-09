import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/skeletons";
import { TwoFactorForm, type Method } from "./two-factor-form";

export const metadata: Metadata = { title: "Two-factor authentication" };

type SearchParams = Promise<{ methods?: string }>;

// Shown after a correct password when the account has 2FA turned on.
// Better Auth keeps a short-lived cookie that links this step to that sign-in.
export default function TwoFactorPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <Suspense fallback={<CardSkeleton />}>
        <TwoFactor searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function TwoFactor({ searchParams }: { searchParams: SearchParams }) {
  const { methods } = await searchParams;
  const list = (methods ?? "").split(",").filter((m): m is "totp" | "otp" => m === "totp" || m === "otp");
  // Backup codes only exist for accounts that set up an authenticator app.
  const available: Method[] = list.length ? [...list, ...(list.includes("totp") ? (["backup"] as const) : [])] : ["totp", "otp", "backup"];
  return <TwoFactorForm methods={available} />;
}
