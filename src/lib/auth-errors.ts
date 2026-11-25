type AuthError = { code?: string | undefined; status?: number | undefined };

const WRONG_CREDENTIALS = "E-mail nebo heslo nesouhlasí.";
export const NETWORK_ERROR =
  "Přihlášení se nepovedlo. Zkontrolujte připojení a zkuste to znovu.";
const GENERIC = "Přihlášení se nepovedlo. Zkuste to znovu.";

const MESSAGES = new Map<string, string>([
  ["INVALID_EMAIL_OR_PASSWORD", WRONG_CREDENTIALS],
  ["INVALID_EMAIL", "Zadejte platný e-mail."],
  ["BANNED_USER", "Účet je zablokovaný. Obraťte se na majitele pekárny."],
]);

/**
 * Czech message for a Better Auth sign-in error. Never reveals whether the
 * account exists. Only a real credentials error says "wrong password"; other
 * rejections (e.g. an untrusted origin) get the generic message.
 */
export function signInErrorMessage(error: AuthError): string {
  const known = error.code ? MESSAGES.get(error.code) : undefined;
  if (known) return known;
  if (error.status === 401) return WRONG_CREDENTIALS;
  if (error.status === 429) return "Příliš mnoho pokusů. Zkuste to za minutu.";
  return GENERIC;
}
