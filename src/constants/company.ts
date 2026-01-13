export const COMPANY_DOMAIN = process.env.EXPO_PUBLIC_COMPANY_DOMAIN || '';

/**
 * Checks if an email address belongs to the company domain
 * For testing: outlook.com is whitelisted
 */
export function isCompanyEmail(email: string): boolean {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  // For testing: allow outlook.com
  if (lowerEmail.endsWith('@outlook.com')) return true;
  // Check company domain
  if (!COMPANY_DOMAIN) return false;
  return lowerEmail.endsWith(`@${COMPANY_DOMAIN.toLowerCase()}`);
}
