// Cấu hình Tailwind của các trang quản trị (dashboard, LandForms-admin, user-management, business-form-templates).
// Trước đây 3 trang này dựng CSS trên trình duyệt bằng cdn.tailwindcss.com kèm một tailwind.config inline
// lặp lại ở từng trang; giờ build sẵn một lần: npm run css:build:admin → AI_Legal/public/tailwind-admin.css.
// Bảng màu/cỡ chữ của trang quản trị khác các trang người dùng nên tách riêng khỏi tailwind.config.js.
module.exports = {
  content: [
    './AI_Legal/src/pages/dashboard.html',
    './AI_Legal/src/pages/LandForms-admin.html',
    './AI_Legal/src/pages/user-management.html',
    './AI_Legal/src/pages/business-form-templates.html',
    // Shell dùng chung (sidebar/topbar) được server chèn vào từng trang quản trị.
    './AI_Legal/src/partials/admin-sidebar.html',
    './AI_Legal/src/partials/admin-topbar.html',
    // HTML dựng bằng JS ở public (admin-ai-chat.js, admin-dashboard-data.js, admin-api.js...).
    './AI_Legal/public/**/*.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Bảng màu đồng bộ dashboard.html: nền be (#f4e9e4 → #fffaf8), nhấn đỏ gạch (#a64031 → #b74f3b).
        primary: '#a64031',
        'primary-container': '#b95341',
        'primary-dark': '#812f24',
        'on-primary': '#ffffff',
        'on-primary-container': '#fff4f0',
        'primary-fixed': '#f7e2db',
        'primary-fixed-dim': '#ecc8bc',
        'on-primary-fixed-variant': '#8f3627',
        'on-primary-fixed': '#4a1f16',
        'inverse-primary': '#e0a595',

        tertiary: '#8f3627',
        'tertiary-container': '#b95341',
        'tertiary-fixed': '#f8ece6',
        'tertiary-fixed-dim': '#eccdbf',
        'on-tertiary': '#ffffff',
        'on-tertiary-fixed': '#6b2a1d',
        'on-tertiary-fixed-variant': '#8f3627',
        'on-tertiary-container': '#fff6f2',

        surface: '#f4e9e4',
        'surface-panel': '#fffaf8',
        'surface-subtle': '#faf3ef',
        'surface-brand-tint': '#fdf1ec',
        'surface-container-lowest': '#fffaf8',
        'surface-container-low': '#f7ece6',
        'surface-container': '#f0e0d8',
        'surface-container-high': '#e9d5cb',
        'surface-container-highest': '#e0c7bc',
        'surface-dim': '#ead9d1',
        'surface-bright': '#fffaf8',
        'surface-variant': '#f4e7e0',
        'surface-tint': '#a64031',

        'on-surface': '#51332d',
        'on-surface-variant': '#8e6b63',
        secondary: '#8e6b63',
        'secondary-container': '#f0ded6',
        'secondary-fixed': '#f0ded6',
        'secondary-fixed-dim': '#e0c7bc',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#51332d',
        'on-secondary-fixed': '#51332d',
        'on-secondary-fixed-variant': '#8e6b63',

        'border-subtle': '#ead7d0',
        'border-focus': '#a64031',
        outline: '#d9b8ae',
        'outline-variant': '#ead7d0',

        'state-success': '#15803d',
        'state-error': '#a64031',
        error: '#a64031',
        'error-container': '#f7e2db',
        'on-error': '#ffffff',
        'on-error-container': '#8f3627',

        // 3 trang quản trị cũ dùng thang màu mặc định của Tailwind (đỏ crimson, hổ phách, hồng).
        // Ánh xạ lại sang tông đỏ gạch / be ấm của dashboard để không còn mảng đỏ thiên hồng.
        red: {
          50: '#fdf3f0',
          100: '#f7e2db',
          200: '#f0cec4',
          300: '#e5ab9d',
          400: '#d98d79',
          500: '#c9664f',
          600: '#bd5440',
          700: '#a64031',
          800: '#8f3627',
          900: '#812f24',
          950: '#5f2318'
        },
        rose: {
          50: '#fdf3f0',
          100: '#f7e2db',
          200: '#f0cec4',
          300: '#e5ab9d',
          400: '#d98d79',
          500: '#c9664f',
          600: '#bd5440',
          700: '#a64031',
          800: '#8f3627',
          900: '#812f24',
          950: '#5f2318'
        },
        amber: {
          50: '#faf4f1',
          100: '#f8ece6',
          200: '#f0dcd3',
          300: '#e3c3b6',
          400: '#d1a08d',
          500: '#bd5440',
          600: '#a64031',
          700: '#8f3627',
          800: '#7a3122',
          900: '#6b2a1d',
          950: '#4a1f16'
        }
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px'
      },
      spacing: {
        gutter: '1.5rem',
        margin: '2rem',
        'space-xl': '2.5rem',
        'space-lg': '1.5rem',
        'space-sm': '0.5rem',
        'space-xs': '0.25rem',
        'space-md': '1rem'
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'sans-serif'],
        'body-md': ['Be Vietnam Pro', 'sans-serif'],
        'display-hero': ['Be Vietnam Pro', 'sans-serif'],
        'label-sm': ['Be Vietnam Pro', 'sans-serif'],
        'label-badge': ['Be Vietnam Pro', 'sans-serif'],
        'label-code': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        'headline-lg-mobile': ['Be Vietnam Pro', 'sans-serif'],
        'headline-lg': ['Be Vietnam Pro', 'sans-serif'],
        'body-sm': ['Be Vietnam Pro', 'sans-serif'],
        'body-lg': ['Be Vietnam Pro', 'sans-serif'],
        'label-lg': ['Be Vietnam Pro', 'sans-serif'],
        'headline-sm': ['Be Vietnam Pro', 'sans-serif'],
        'title-md': ['Be Vietnam Pro', 'sans-serif'],
        'label-md': ['Be Vietnam Pro', 'sans-serif'],
        'headline-md': ['Be Vietnam Pro', 'sans-serif']
      },
      fontSize: {
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'display-hero': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
        'label-badge': ['11px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '600' }],
        'label-code': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'headline-lg-mobile': ['26px', { lineHeight: '34px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.01em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'title-md': ['15px', { lineHeight: '22px', fontWeight: '600' }],
        'label-md': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }]
      }
    }
  },
  plugins: []
};
