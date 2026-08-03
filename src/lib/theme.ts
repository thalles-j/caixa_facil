import { useSyncExternalStore } from 'react';

const THEME_KEY = 'mnb-theme';
const listeners = new Set<() => void>();

export function getInitialDark(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark';
  } catch {
    return false;
  }
}

export function applyDarkPreference(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    // localStorage indisponível — preferência não persiste, mas a troca visual ainda funciona
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Estado de modo escuro compartilhado entre qualquer componente que use este hook (ex: header e Configurações). */
export function useDarkMode(): [boolean, (dark: boolean) => void] {
  const dark = useSyncExternalStore(subscribe, getInitialDark, () => false);
  return [dark, applyDarkPreference];
}
