import {
  Car,
  ForkKnife,
  Gift,
  GraduationCap,
  Hamburger,
  Heartbeat,
  HouseLine,
  Laptop,
  Motorcycle,
  PaintBrush,
  Scissors,
  Storefront,
  TShirt,
  Wrench,
  type Icon,
} from '@phosphor-icons/react';

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
  'Alimentação (Mercado, Padaria...)': { icon: Hamburger, accent: '#C1602E' },
  'Bar, Restaurante e Lanchonete': { icon: ForkKnife, accent: '#A64B32' },
  'Vestuário e Acessórios': { icon: TShirt, accent: '#7A3B6B' },
  'Beleza e Cosméticos': { icon: Scissors, accent: '#B4476B' },
  'Motorista de Aplicativo': { icon: Car, accent: '#306A61' },
  'Entregas e Motofrete': { icon: Motorcycle, accent: '#9A681F' },
  'Manutenção e Reparos': { icon: Wrench, accent: '#2B6E77' },
  'Saúde e Bem-estar': { icon: Heartbeat, accent: '#3E7A65' },
  'Casa e Construção': { icon: HouseLine, accent: '#9A633B' },
  'Tecnologia e Eletrônicos': { icon: Laptop, accent: '#416A91' },
  'Educação e Aulas': { icon: GraduationCap, accent: '#5B5E9A' },
  'Artesanato e Presentes': { icon: Gift, accent: '#A05273' },
  Serviços: { icon: Wrench, accent: '#2B6E77' },
  Outros: { icon: PaintBrush, accent: DEFAULT_THEME.accent },
};

export function getCategoryTheme(categoria: string | undefined): CategoryTheme {
  if (!categoria) return DEFAULT_THEME;
  return categoryThemes[categoria] ?? DEFAULT_THEME;
}
