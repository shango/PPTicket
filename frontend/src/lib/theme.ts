export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

/**
 * The user row is the source of truth for a signed-in user, but it only arrives
 * after `getMe()`. A copy is kept in localStorage so the inline script in
 * index.html can paint the right theme immediately, and so anonymous viewers -
 * who have no user row at all - still get a preference that sticks.
 */
export function getTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}
