// Generates APPLE_CLIENT_SECRET: an ES256 JWT signed with your .p8 key.
// Apple caps its lifetime at 6 months, so re-run this before it expires.
import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY_PATH } = process.env;
const missing = Object.entries({ APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY_PATH })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const key = await importPKCS8(readFileSync(APPLE_PRIVATE_KEY_PATH, "utf8"), "ES256");
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
  .setIssuer(APPLE_TEAM_ID)
  .setSubject(APPLE_CLIENT_ID)
  .setAudience("https://appleid.apple.com")
  .setIssuedAt()
  .setExpirationTime("180d")
  .sign(key);

console.log(`APPLE_CLIENT_SECRET=${jwt}`);
console.error("\nPaste that line into .env.local. It expires in 180 days.");
