const THEME_KEY = 'mnb-theme';

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
}
