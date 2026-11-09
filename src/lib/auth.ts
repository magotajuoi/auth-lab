import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import {
  emailOTP,
  haveIBeenPwned,
  lastLoginMethod,
  magicLink,
  oneTap,
  twoFactor,
  username,
} from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import Database from "better-sqlite3";
import { sendMail } from "./mailer";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const appName = "auth-lab";

type SocialProviders = NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]>;
export type ProviderId = "google" | "apple" | "github";

const socialProviders: SocialProviders = {};

// Each provider only switches on once its keys are in .env.local.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    prompt: "select_account",
  };
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  };
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

export const enabledProviders = Object.keys(socialProviders) as ProviderId[];

// The 2FA plugin only guards password sign-ins. Email codes and magic links
// would otherwise skip it, so for accounts with 2FA on we undo those sign-ins
// and send people to password + code (or a passkey). This runs *after* the
// code/link is checked, so it can't be used to find out who has 2FA.
const emailOnlySignInPaths = new Set(["/sign-in/email-otp", "/magic-link/verify"]);
const requireTwoFactorForEmailSignIn = createAuthMiddleware(async (ctx) => {
  if (!emailOnlySignInPaths.has(ctx.path)) return;
  const created = ctx.context.newSession;
  if (!created?.user.twoFactorEnabled) return;
  deleteSessionCookie(ctx);
  await ctx.context.internalAdapter.deleteSession(created.session.token);
  ctx.context.setNewSession(null);
  if (ctx.path === "/magic-link/verify") throw ctx.redirect("/?error=two_factor_required");
  throw new APIError("FORBIDDEN", {
    code: "TWO_FACTOR_REQUIRED",
    message: "This account uses two-factor authentication. Sign in with your password and code, or a passkey.",
  });
});

export const auth = betterAuth({
  appName,
  baseURL,
  database: new Database("auth.db"),
  socialProviders,

  // Classic sign-up / sign-in with email (or username) + password.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Password accounts must prove they own the email before signing in.
    // This also stops someone pre-registering your email and later
    // inheriting your Google/Apple sign-in.
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      // Not awaited, so response timing doesn't reveal whether the email exists.
      void sendMail({
        to: user.email,
        subject: "Reset your password",
        text: "Someone asked to reset your password. If it was you, open the link below. It expires in 1 hour.",
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true, // re-send if an unverified user tries to sign in
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      void sendMail({
        to: user.email,
        subject: "Verify your email",
        text: "Confirm your email address to finish creating your account.",
        url,
      });
    },
  },

  user: {
    deleteUser: {
      enabled: true,
      // Accounts without a password confirm deletion from their inbox.
      sendDeleteAccountVerification: async ({ user, url }) => {
        void sendMail({
          to: user.email,
          subject: "Confirm account deletion",
          text: "Open this link to permanently delete your account. If you didn't ask for this, ignore this email.",
          url,
        });
      },
    },
  },

  // Apple posts its callback from appleid.apple.com (response_mode=form_post).
  trustedOrigins: ["https://appleid.apple.com"],
  account: {
    // Same verified email via several providers -> one user, linked accounts.
    accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },

  hooks: { after: requireTwoFactorForEmailSignIn },

  // On by default only in production; enabled here so you can see it work.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/username": { window: 60, max: 5 },
      "/two-factor/*": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/sign-in/magic-link": { window: 60, max: 3 },
    },
  },

  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),

    // Face ID / Touch ID / Windows Hello / security keys.
    passkey({
      rpName: appName,
      rpID: new URL(baseURL).hostname,
      origin: baseURL,
    }),

    // Second step after password sign-in: a code from an authenticator app
    // (+ backup codes), or a code sent by email.
    twoFactor({
      issuer: appName,
      allowPasswordless: true, // Google-only users can turn it on too
      otpOptions: {
        period: 5, // minutes
        allowedAttempts: 5,
        sendOTP: async ({ user, otp }) => {
          void sendMail({
            to: user.email,
            subject: `Your verification code: ${otp}`,
            text: `Someone signed in to your account with your password. Enter ${otp} to finish. It expires in 5 minutes. If this wasn't you, change your password.`,
            code: otp,
          });
        },
      },
    }),

    // Passwordless email: 6-digit code...
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "sign-in") return;
        void sendMail({
          to: email,
          subject: `Your sign-in code: ${otp}`,
          text: `Enter ${otp} to sign in. It expires in 10 minutes.`,
          code: otp,
        });
      },
    }),
    // ...or a one-click link.
    magicLink({
      expiresIn: 10 * 60,
      sendMagicLink: async ({ email, url }) => {
        void sendMail({
          to: email,
          subject: "Your sign-in link",
          text: "Click to sign in. The link expires in 10 minutes and works once.",
          url,
        });
      },
    }),

    oneTap(), // Google One Tap popup
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "This password has appeared in a known data breach. Please choose a different one.",
    }),
    lastLoginMethod(), // remembers which method you used last (cookie)

    nextCookies(), // must stay last
  ],
});
