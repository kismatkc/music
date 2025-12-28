// lib/tokens.ts - KURATE Music App Design System
// Elegant, muted theme - sophisticated without being loud

/**
 * ELEGANT MUTED MUSIC APP COLOR PALETTE
 * Sophisticated slate blues with soft amber accents
 * - Deep Slate: Base colors (#1C1E26, #2A2D3A, #3A3F50)
 * - Soft Amber: Subtle accent (#D4A574, #C9975B)
 * - Cool Grays: Professional and clean
 */

const colorPalette = {
  // Deep slate backgrounds (elegant, sophisticated)
  deepSlate: '#1C1E26',
  darkSlate: '#2A2D3A',
  mediumSlate: '#3A3F50',
  lightSlate: '#4A5068',
  elevatedSlate: '#525870',

  // Soft amber/gold accents (warm but subtle)
  amberPrimary: '#D4A574',
  amberMuted: '#C9975B',
  amberLight: '#E3C9A8',
  amberDark: '#B8885A',

  // Cool blue accents (secondary)
  coolBlue: '#7B9EB8',
  softBlue: '#8FADC7',
  paleBlue: '#A5BED6',

  // Text colors (refined hierarchy)
  pureWhite: '#FFFFFF',
  softWhite: '#F0F2F5',
  lightGray: '#C5CAD4',
  mediumGray: '#9BA3B4',
  mutedGray: '#6B7280',
  dimGray: '#4B5563',

  // Borders and dividers (very subtle)
  subtleBorder: '#2F3342',
  mediumBorder: '#3D4354',

  // Semantic colors (muted versions)
  success: '#6EBF8B',
  warning: '#E4B45E',
  error: '#D47B7B',

  // Overlay
  overlay: 'rgba(28, 30, 38, 0.94)',
  cardOverlay: 'rgba(58, 63, 80, 0.35)',
};

export const tokens = {
  colors: {
    bg: {
      primary: colorPalette.deepSlate,
      secondary: colorPalette.darkSlate,
      tertiary: colorPalette.mediumSlate,
      elevated: colorPalette.lightSlate,
      input: colorPalette.mediumSlate,
      card: colorPalette.cardOverlay,
    },
    text: {
      primary: colorPalette.pureWhite,
      secondary: colorPalette.lightGray,
      tertiary: colorPalette.mediumGray,
      muted: colorPalette.mutedGray,
      inverse: colorPalette.pureWhite,
    },
    accent: {
      primary: colorPalette.amberPrimary,
      secondary: colorPalette.coolBlue,
      button: colorPalette.amberPrimary,
      buttonAlt: colorPalette.coolBlue,
      gradient1: colorPalette.amberPrimary,
      gradient2: colorPalette.amberLight,
      highlight: colorPalette.softBlue,
    },
    border: {
      default: colorPalette.subtleBorder,
      subtle: colorPalette.subtleBorder,
      strong: colorPalette.mediumBorder,
      focus: colorPalette.amberMuted,
    },
    success: colorPalette.success,
    warning: colorPalette.warning,
    error: colorPalette.error,
    info: colorPalette.coolBlue,
    disabled: colorPalette.dimGray,
    overlay: colorPalette.overlay,
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    heading: 28,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
  radius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    full: 9999,
  },
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.26,
      shadowRadius: 16,
      elevation: 8,
    },
    player: {
      shadowColor: colorPalette.amberPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    glow: {
      shadowColor: colorPalette.coolBlue,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
  },
  opacity: {
    disabled: 0.4,
  },
} as const;

export const pressOpacity = {
  strong: 0.5,
  default: 0.7,
  light: 0.85,
} as const;

export const timing = {
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 800,
} as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  popover: 40,
  toast: 50,
  player: 100,
};

export default tokens;
