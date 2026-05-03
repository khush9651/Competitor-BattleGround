import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange) {
  const el = document.documentElement;
  const obs = new MutationObserver(() => onStoreChange());
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark');
}

/** Server / SSR: assume dark to avoid flash mismatch */
function getServerSnapshot() {
  return true;
}

/** True when `<html class="dark">` is present (Tailwind class strategy). */
export function useDarkMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
