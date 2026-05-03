import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '../theme.js';

function subscribe(onStoreChange) {
  const el = document.documentElement;
  const obs = new MutationObserver(() => onStoreChange());
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

function isDarkSnapshot() {
  return document.documentElement.classList.contains('dark');
}

/**
 * Navbar control: ☀️ when dark (switch to light), 🌙 when light (switch to dark).
 */
export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, isDarkSnapshot, () => true);

  const toggleTheme = () => {
    const nextDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(THEME_STORAGE_KEY, nextDark ? 'dark' : 'light');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-lg shadow-sm transition-colors duration-300 hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/15 dark:bg-slate-800/80 dark:shadow-none dark:hover:border-indigo-400/50 dark:hover:bg-slate-800"
    >
      <span className="sr-only">{isDark ? 'Activate light mode' : 'Activate dark mode'}</span>
      <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
