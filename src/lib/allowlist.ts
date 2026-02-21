const normalizeEmail = (value: string) =>
  value
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .toLowerCase();

export const getAllowedEmails = () =>
  String(process.env.ALLOWED_EMAILS ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

export const isAllowlistEnabled = () => getAllowedEmails().length > 0;

export const isEmailAllowed = (email?: string | null) => {
  if (!email) return false;
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return true;
  return allowed.includes(normalizeEmail(email));
};
