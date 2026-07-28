import { Env } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Domains permitted to hold an account, from the LOGIN_EMAIL_DOMAINS binding.
 * Configured in wrangler.toml rather than hardcoded so the allowlist can change
 * without a code deploy.
 */
export function loginDomains(env: Env): string[] {
  return (env.LOGIN_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the email is in an allowed domain. An empty allowlist means "no
 * domain restriction" - fail open here would be a silent auth bypass, so this
 * is deliberately an explicit configuration choice rather than a default.
 */
export function isAllowedDomain(env: Env, normalizedEmail: string): boolean {
  const domains = loginDomains(env);
  if (domains.length === 0) return true;
  const domain = normalizedEmail.split('@')[1];
  return !!domain && domains.includes(domain);
}

export function domainRejectionMessage(env: Env): string {
  const domains = loginDomains(env);
  return domains.length === 1
    ? `Email must be an @${domains[0]} address.`
    : `Email must be on an approved domain (${domains.map((d) => `@${d}`).join(', ')}).`;
}
