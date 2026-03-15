export const Colors = {
  background: '#0A0A0F',
  surface: '#13131A',
  surface2: '#1C1C26',
  accent: '#00E5A0',
  accent2: '#FF6B6B',
  accent3: '#FFB347',
  accent4: '#74B9FF',
  text: '#FFFFFF',
  textMuted: '#8A8A9A',
  textDisabled: '#4A4A5A',
  border: '#2A2A3A',
  overlay: 'rgba(0,0,0,0.6)',
};

export const Typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
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
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 50,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  accent: {
    shadowColor: '#00E5A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const MacroColors = {
  protein: '#74B9FF',
  carbs: '#FFB347',
  fat: '#FF6B6B',
  calories: '#00E5A0',
};
