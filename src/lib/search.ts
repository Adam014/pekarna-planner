/** Lower case without diacritics and extra spaces: "dvorakova" finds "Dvořáková". */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

/**
 * Whether a customer matches what staff typed: part of the name, or at least
 * three digits of the phone number, typed or pasted with +420 or 00420.
 */
export function matchesCustomer(
  customer: { name: string; phone: string },
  query: string,
): boolean {
  const text = fold(query);
  if (!text) return true;
  if (fold(customer.name).includes(text)) return true;
  const digits = query.replace(/\D/g, "").replace(/^00/, "");
  const national = customer.phone.replace(/^\+420/, "");
  return (
    digits.length >= 3 &&
    /^[\d\s+()-]+$/.test(query.trim()) &&
    (customer.phone.slice(1).includes(digits) || national.includes(digits))
  );
}
