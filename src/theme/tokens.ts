// Design tokens — change here, affects all components
export const tokens = {
  // Colors
  color: {
    // Neutrals
    white: '#ffffff',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',

    // Status
    green50: '#f0fdf4',
    green100: '#dcfce7',
    green600: '#16a34a',
    green700: '#15803d',

    red50: '#fef2f2',
    red100: '#fee2e2',
    red600: '#dc2626',
    red700: '#b91c1c',

    yellow50: '#fefce8',
    yellow100: '#fef9c3',
    yellow600: '#ca8a04',
    yellow700: '#a16207',

    blue50: '#eff6ff',
    blue100: '#dbeafe',
    blue600: '#2563eb',
    blue700: '#1d4ed8',

    purple50: '#faf5ff',
    purple100: '#f3e8ff',
    purple600: '#9333ea',

    orange50: '#fff7ed',
    orange100: '#ffedd5',
    orange600: '#ea580c',
  },

  // Confidence badge classes
  confidence: {
    high: 'bg-green-100 text-green-700 border border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    low: 'bg-gray-100 text-gray-600 border border-gray-200',
  },

  // Spacing (Tailwind scale reference)
  spacing: {
    xs: '0.25rem',   // p-1
    sm: '0.5rem',    // p-2
    md: '0.75rem',   // p-3
    lg: '1rem',      // p-4
    xl: '1.5rem',    // p-6
    '2xl': '2rem',   // p-8
  },

  // Border radius
  radius: {
    sm: '0.25rem',   // rounded
    md: '0.375rem',  // rounded-md
    lg: '0.5rem',    // rounded-lg
    xl: '0.75rem',   // rounded-xl
    full: '9999px',  // rounded-full
  },

  // Typography
  text: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
} as const

// Semantic class bundles
export const cls = {
  card: 'bg-white border border-gray-200 rounded-lg',
  cardHover: 'bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors',
  btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
  btnSecondary: 'bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 transition-colors',
  btnGhost: 'text-gray-500 hover:text-gray-700 text-sm px-2 py-1 rounded transition-colors',
  btnDanger: 'bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
  input: 'border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  label: 'block text-xs font-medium text-gray-600 mb-1',
  badge: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
  section: 'bg-gray-50 border border-gray-200 rounded-lg p-4',
  positive: 'text-green-600 font-medium',
  negative: 'text-red-600 font-medium',
  neutral: 'text-gray-700',
  muted: 'text-gray-400',
  highlight: 'bg-yellow-100 text-yellow-800 rounded px-0.5',
} as const
