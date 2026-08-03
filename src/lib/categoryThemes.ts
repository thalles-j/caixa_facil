import { Hamburger, TShirt, Scissors, Wrench, Storefront, type Icon } from '@phosphor-icons/react';
import { RAMOS_ATUACAO } from '../types';

export interface CategoryTheme {
  icon: Icon;
  /** Cor de "tinta de carimbo" — usada no selo do ícone e em pequenos detalhes de destaque. */
  accent: string;
}

const DEFAULT_THEME: CategoryTheme = {
  icon: Storefront,
  accent: '#5B5340',
};

export const categoryThemes: Record<string, CategoryTheme> = {
  [RAMOS_ATUACAO[0]]: {
    icon: Hamburger,
    accent: '#C1602E',
  },
  [RAMOS_ATUACAO[1]]: {
    icon: TShirt,
    accent: '#7A3B6B',
  },
  [RAMOS_ATUACAO[2]]: {
    icon: Scissors,
    accent: '#B4476B',
  },
  [RAMOS_ATUACAO[3]]: {
    icon: Wrench,
    accent: '#2B6E77',
  },
  [RAMOS_ATUACAO[4]]: DEFAULT_THEME,
};

export function getCategoryTheme(categoria: string | undefined): CategoryTheme {
  if (!categoria) return DEFAULT_THEME;
  return categoryThemes[categoria] ?? DEFAULT_THEME;
}
