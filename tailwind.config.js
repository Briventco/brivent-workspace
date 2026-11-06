/**
 * Every value comes from src/assets/brivent/tokens/brivent.css. The default palette is replaced
 * rather than extended, so a colour outside the design system doesn't compile.
 */
const token = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      ink: token('ink'),
      'ink-800': token('ink-800'),
      'ink-700': token('ink-700'),
      'ink-600': token('ink-600'),
      brand: token('brand'),
      'brand-hover': token('brand-hover'),
      'brand-press': token('brand-press'),
      'brand-50': token('brand-50'),
      'brand-100': token('brand-100'),
      lavender: token('lavender'),
      bg: token('bg'),
      surface: token('surface'),
      'surface-2': token('surface-2'),
      border: token('border'),
      'border-strong': token('border-strong'),
      text: token('text'),
      'text-2': token('text-2'),
      'text-3': token('text-3'),
      'on-brand': token('on-brand'),
      nav: token('nav-bg'),
      'nav-text': token('nav-text'),
      'nav-label': token('nav-label'),
      'nav-hover': token('nav-hover'),
      'nav-active': token('nav-active'),
      danger: token('danger'),
      'danger-bg': token('danger-bg'),
      warning: token('warning'),
      'warning-bg': token('warning-bg'),
      success: token('success'),
      'success-bg': token('success-bg'),
      info: token('info'),
      'info-bg': token('info-bg'),
    },
    fontFamily: {
      sans: token('font'),
    },
    // [size, { lineHeight, fontWeight, letterSpacing }], matching the .t-* classes.
    fontSize: {
      display: ['30px', { lineHeight: '38px', fontWeight: '700', letterSpacing: '-0.02em' }],
      h1: ['24px', { lineHeight: '32px', fontWeight: '700', letterSpacing: '-0.015em' }],
      h2: ['18px', { lineHeight: '26px', fontWeight: '600', letterSpacing: '-0.01em' }],
      h3: ['15px', { lineHeight: '22px', fontWeight: '600' }],
      body: ['14px', '20px'],
      small: ['13px', '18px'],
      caption: ['12px', '16px'],
      over: ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.06em' }],
    },
    borderRadius: {
      none: '0',
      DEFAULT: token('r-xs'),
      xs: token('r-xs'),
      sm: token('r-sm'),
      md: token('r-md'),
      lg: token('r-lg'),
      xl: token('r-xl'),
      full: token('r-full'),
    },
    boxShadow: {
      none: 'none',
      xs: token('sh-xs'),
      sm: token('sh-sm'),
      md: token('sh-md'),
      lg: token('sh-lg'),
    },
    extend: {},
  },
  plugins: [],
};
