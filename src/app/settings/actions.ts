"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";

// Better Auth only allows setting a *first* password from the server,
// so accounts created with Google/Apple/email-code add one through here.
export async function setPasswordAction(newPassword: string): Promise<{ error?: string }> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return { error: "You're not signed in." };
  try {
    await auth.api.setPassword({ body: { newPassword }, headers: requestHeaders });
    return {};
  } catch (e) {
    return { error: e instanceof APIError ? e.message : "Couldn't set your password." };
  }
}
