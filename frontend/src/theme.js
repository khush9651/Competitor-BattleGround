/** localStorage key — must match ThemeToggle */
export const THEME_STORAGE_KEY = 'theme';

/**
 * Apply saved theme before first paint (call from main.jsx).
 * Default: dark (matches legacy app look).
 */
export function bootstrapTheme() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
