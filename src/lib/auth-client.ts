import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  lastLoginMethodClient,
  magicLinkClient,
  oneTapClient,
  twoFactorClient,
  usernameClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    passkeyClient(),
    twoFactorClient({
      // Password was right but the account has 2FA: go enter the code.
      // Runs outside React (no router available), so a full navigation is right here.
      onTwoFactorRedirect({ twoFactorMethods }) {
        const methods = (twoFactorMethods ?? []).join(",");
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/two-factor?methods=${encodeURIComponent(methods)}`;
      },
    }),
    emailOTPClient(),
    magicLinkClient(),
    oneTapClient({
      clientId: googleClientId,
      context: "signin",
      cancelOnTapOutside: true,
      promptOptions: { maxAttempts: 1 },
    }),
    lastLoginMethodClient(),
  ],
});
