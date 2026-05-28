export function normalizeEmail(email: string): string {
  if (!email) return email;
  const [localPart, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return email.trim().toLowerCase();
  const normalizedLocal = localPart.replace(/\./g, "").replace(/\+.*$/, "");
  return `${normalizedLocal}@${domain}`;
}
