export const Colors = {
  background: '#FFFFFF',
  backgroundSubtle: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#F0F4FF',
  border: '#E8ECF4',
  primary: '#2D6BE4',
  primaryLight: '#EEF3FD',
  primaryDark: '#1A4FC4',
  protein: '#2D6BE4',
  carbs: '#F5A623',
  fat: '#E85D75',
  success: '#27AE60',
  textPrimary: '#0D1B3E',
  textSecondary: '#6B7A99',
  textDisabled: '#B0BAD0',
  shadow: 'rgba(45, 107, 228, 0.08)',
  white: '#FFFFFF',
  black: '#000000',
};

export const Typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  pill: 50,
};

export const Shadow = {
  card: {
    shadowColor: '#2D6BE4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  strong: {
    shadowColor: '#2D6BE4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
};

export const MacroColors = {
  protein: '#2D6BE4',
  carbs: '#F5A623',
  fat: '#E85D75',
  calories: '#0D1B3E',
};
