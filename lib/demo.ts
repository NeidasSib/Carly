const DEMO_EMAIL = process.env.DEMO_LOGIN_EMAIL;

/**
 * Returns true if the given email belongs to the configured demo account.
 * Used to restrict certain actions (e.g. company create/delete, account delete).
 */
export function isDemoUser(email: string | undefined): boolean {
  if (!email || !DEMO_EMAIL) return false;
  return email.toLowerCase().trim() === DEMO_EMAIL.toLowerCase().trim();
}
