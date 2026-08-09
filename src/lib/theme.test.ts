// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { getAutomaticDark, getInitialDark, initializeTheme } from './theme';

describe('tema por horário', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('usa o modo escuro durante a noite e claro durante o dia', () => {
    expect(getAutomaticDark(new Date(2026, 7, 9, 5, 59))).toBe(true);
    expect(getAutomaticDark(new Date(2026, 7, 9, 6))).toBe(false);
    expect(getAutomaticDark(new Date(2026, 7, 9, 17, 59))).toBe(false);
    expect(getAutomaticDark(new Date(2026, 7, 9, 18))).toBe(true);
  });

  it('respeita uma preferência manual salva', () => {
    localStorage.setItem('caixafacil-theme', 'dark');
    expect(getInitialDark()).toBe(true);

    localStorage.setItem('caixafacil-theme', 'light');
    expect(getInitialDark()).toBe(false);
  });

  it('aplica o tema inicial no documento', () => {
    localStorage.setItem('caixafacil-theme', 'dark');
    initializeTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
