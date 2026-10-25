export const colors = {
  // Official Koki Master Palette
  primary: '#663c00',        // Marrom principal: botões principais, navegação, destaques
  primaryDark: '#33220A',    // Marrom escuro: textos principais e títulos
  caramel: '#cc9a52',        // Caramelo: gráficos, ícones e detalhes
  goldenBeige: '#ffd599',    // Bege dourado: elementos secundários
  background: '#fff6e9',     // Creme: fundo principal
  cardBackground: '#ffffff', // Branco puro para cards em Flat Design
  surface: '#f9f1e7',        // Superfície intermediária
  border: '#e8d7c3',         // Bordas suaves
  danger: '#c2312a',         // Vermelho: erros, negativos e cancelamentos
  success: '#009933',        // Verde: positivos, quitados, entregues
  warning: '#e67e22',        // Laranja de atenção
  
  // Text colors
  text: '#33220A',
  textSecondary: '#6b543e',
  textMuted: '#9e8570',
  textInverse: '#ffffff',

  // Status mappings
  status: {
    pending: '#e67e22',
    in_production: '#cc9a52',
    ready: '#2980b9',
    delivered: '#009933',
    canceled: '#c2312a',
    unpaid: '#c2312a',
    partial: '#e67e22',
    paid: '#009933',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

export const typography = {
  fontFamily: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 30,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
