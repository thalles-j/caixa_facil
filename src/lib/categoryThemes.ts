import { Hamburger, TShirt, Scissors, Wrench, Storefront, type Icon } from '@phosphor-icons/react';
import { RAMOS_ATUACAO } from '../types';

export interface CategoryTheme {
  icon: Icon;
  gradient: string; // classes Tailwind para bg-gradient-to-br
  solid: string; // classe Tailwind de cor sólida equivalente (badges, ícones pequenos)
}

const DEFAULT_THEME: CategoryTheme = {
  icon: Storefront,
  gradient: 'from-slate-500 to-slate-700',
  solid: 'bg-slate-600',
};

export const categoryThemes: Record<string, CategoryTheme> = {
  [RAMOS_ATUACAO[0]]: {
    icon: Hamburger,
    gradient: 'from-orange-500 to-red-600',
    solid: 'bg-orange-600',
  },
  [RAMOS_ATUACAO[1]]: {
    icon: TShirt,
    gradient: 'from-pink-500 to-purple-600',
    solid: 'bg-pink-600',
  },
  [RAMOS_ATUACAO[2]]: {
    icon: Scissors,
    gradient: 'from-pink-400 to-rose-500',
    solid: 'bg-rose-500',
  },
  [RAMOS_ATUACAO[3]]: {
    icon: Wrench,
    gradient: 'from-blue-600 to-blue-800',
    solid: 'bg-blue-600',
  },
  [RAMOS_ATUACAO[4]]: DEFAULT_THEME,
};

export function getCategoryTheme(categoria: string | undefined): CategoryTheme {
  if (!categoria) return DEFAULT_THEME;
  return categoryThemes[categoria] ?? DEFAULT_THEME;
}
