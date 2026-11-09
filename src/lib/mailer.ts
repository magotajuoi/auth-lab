// Local-only "mailer": nothing leaves your machine. Emails are printed to the
// dev-server terminal and kept in memory for the /dev/outbox page.
// To send real email later, replace sendMail with a Resend/SMTP call.

export type Mail = {
  id: string;
  to: string;
  subject: string;
  text: string;
  url?: string;
  code?: string;
  sentAt: Date;
};

// globalThis survives Next.js hot reloads and is shared by routes and pages.
const store = globalThis as unknown as { __authLabOutbox?: Mail[] };
export const outbox: Mail[] = (store.__authLabOutbox ??= []);

export async function sendMail(mail: Omit<Mail, "id" | "sentAt">) {
  outbox.unshift({ ...mail, id: crypto.randomUUID(), sentAt: new Date() });
  outbox.length = Math.min(outbox.length, 50);
  console.log(`\n✉️  Email to ${mail.to}: ${mail.subject}\n   ${mail.url ?? `code: ${mail.code}`}\n   (also at http://localhost:3000/dev/outbox)\n`);
}
