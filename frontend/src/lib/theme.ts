import { useSyncExternalStore } from 'react';

const THEME_KEY = 'caixafacil-theme';
const listeners = new Set<() => void>();

/** Usa o horário local do aparelho: escuro das 18h às 5h59. */
export function getAutomaticDark(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 18 || hour < 6;
}

export function getInitialDark(): boolean {
  try {
    const preference = localStorage.getItem(THEME_KEY);
    if (preference === 'dark') return true;
    if (preference === 'light') return false;
  } catch {
    // Sem armazenamento, o tema ainda pode seguir o horário local.
  }
  return getAutomaticDark();
}

/** Aplica o tema inicial sem transformar a decisão automática em preferência manual. */
export function initializeTheme() {
  document.documentElement.classList.toggle('dark', getInitialDark());
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
