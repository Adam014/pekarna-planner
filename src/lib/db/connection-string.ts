/**
 * Neon's URLs say `sslmode=require`. node-postgres 8 already treats it as
 * `verify-full` (checks the certificate and host name) but warns that pg 9
 * will switch to libpq's weaker meaning. Asking for `verify-full` keeps
 * today's checks and silences the warning; Neon's certificates are publicly
 * trusted, so verification works without a CA file. Every `sslmode` is
 * changed, since pg reads the last one.
 * https://neon.com/docs/connect/connect-securely
 */
export function withVerifiedTls(url: string): string {
  // With libpq compatibility asked for, these modes mean what libpq says.
  if (/[?&]uselibpqcompat=true(?=&|#|$)/.test(url)) return url;
  return url.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=&|#|$)/g,
    "$1verify-full",
  );
}
