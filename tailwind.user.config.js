// Cấu hình Tailwind của các trang người dùng (user-dashboard, account, form-library, lawyer-registration).
// Trước đây dựng trên trình duyệt bằng cdn.tailwindcss.com mỗi lần mở trang (gây nháy khi chuyển trang);
// giờ build sẵn: npm run css:build:user → AI_Legal/public/tailwind-user.css. Đổi màu/cỡ chữ ở đây.
module.exports = {
  content: [
    './AI_Legal/src/pages/user-dashboard.html',
    './AI_Legal/src/pages/account.html',
    './AI_Legal/src/pages/form-library.html',
    './AI_Legal/src/pages/lawyer-registration.html',
    // Nội dung "Tạo hồ sơ" được chèn vào trang tổng quan (user-dashboard-navigation.js)
    './AI_Legal/src/pages/application-submission.html',
    // HTML dựng bằng JS (user-dashboard-data.js, auth-api.js, admin-ai-chat.js...)
    './AI_Legal/public/**/*.js'
  ],
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "tertiary-fixed": "#ffd9dd",
        "surface-bright": "#fff8f5",
        "tertiary-fixed-dim": "#ffb2bd",
        "secondary-fixed": "#ffdcc3",
        "surface-container-lowest": "#ffffff",
        "surface-variant": "#e9e1dd",
        "on-background": "#1e1b19",
        "secondary-fixed-dim": "#ffb77d",
        "on-tertiary-container": "#ffcbd2",
        "background": "#fff8f5",
        "primary-fixed": "#ffdad6",
        "on-primary-fixed": "#410002",
        "primary-container": "#b91c1c",
        "surface-dim": "#e0d8d5",
        "on-secondary-container": "#663500",
        "on-primary-fixed-variant": "#93000b",
        "surface-tint": "#b91c1c",
        "inverse-surface": "#33302d",
        "primary": "#93000b",
        "on-primary-container": "#ffcdc7",
        "surface-container-low": "#faf2ee",
        "secondary-container": "#fe932c",
        "on-secondary": "#ffffff",
        "primary-fixed-dim": "#ffb4ab",
        "on-tertiary-fixed": "#400014",
        "secondary": "#904d00",
        "on-secondary-fixed": "#2f1500",
        "error": "#ba1a1a",
        "outline": "#8f6f6c",
        "on-primary": "#ffffff",
        "on-secondary-fixed-variant": "#6e3900",
        "surface-container-high": "#eee7e3",
        "on-error": "#ffffff",
        "inverse-on-surface": "#f7efeb",
        "on-surface-variant": "#5b403d",
        "on-error-container": "#93000a",
        "inverse-primary": "#ffb4ab",
        "error-container": "#ffdad6",
        "on-surface": "#1e1b19",
        "tertiary": "#8a1538",
        "on-tertiary-fixed-variant": "#8a1538",
        "on-tertiary": "#ffffff",
        "outline-variant": "#e4beb9",
        "surface": "#fff8f5",
        "surface-container": "#f4ece8",
        "surface-container-highest": "#e9e1dd",
        "tertiary-container": "#aa304f"
      },
      "borderRadius": {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      "spacing": {
        "space-sm": "0.5rem",
        "gutter-mobile": "1rem",
        "space-lg": "1.5rem",
        "margin": "2rem",
        "gutter": "1.5rem",
        "space-xs": "0.25rem",
        "space-md": "1rem",
        "space-xl": "2.5rem",
        "margin-mobile": "1rem"
      },
      "fontFamily": {
        "body-sm": [
          "Be Vietnam Pro"
        ],
        "display": [
          "Be Vietnam Pro"
        ],
        "title-md": [
          "Be Vietnam Pro"
        ],
        "title-lg": [
          "Be Vietnam Pro"
        ],
        "display-mobile": [
          "Be Vietnam Pro"
        ],
        "headline-sm": [
          "Be Vietnam Pro"
        ],
        "headline-lg-mobile": [
          "Be Vietnam Pro"
        ],
        "title-sm": [
          "Be Vietnam Pro"
        ],
        "label-sm": [
          "Be Vietnam Pro"
        ],
        "label-lg": [
          "Be Vietnam Pro"
        ],
        "headline-lg": [
          "Be Vietnam Pro"
        ],
        "body-lg": [
          "Be Vietnam Pro"
        ],
        "body-md": [
          "Be Vietnam Pro"
        ],
        "label-md": [
          "Be Vietnam Pro"
        ],
        "headline-md": [
          "Be Vietnam Pro"
        ]
      },
      "fontSize": {
        "body-sm": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "400"
          }
        ],
        "display": [
          "40px",
          {
            "lineHeight": "48px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ],
        "title-md": [
          "16px",
          {
            "lineHeight": "24px",
            "fontWeight": "600"
          }
        ],
        "title-lg": [
          "18px",
          {
            "lineHeight": "26px",
            "fontWeight": "600"
          }
        ],
        "display-mobile": [
          "30px",
          {
            "lineHeight": "38px",
            "letterSpacing": "-0.01em",
            "fontWeight": "700"
          }
        ],
        "headline-sm": [
          "20px",
          {
            "lineHeight": "28px",
            "fontWeight": "600"
          }
        ],
        "headline-lg-mobile": [
          "24px",
          {
            "lineHeight": "32px",
            "letterSpacing": "0em",
            "fontWeight": "700"
          }
        ],
        "title-sm": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "600"
          }
        ],
        "label-sm": [
          "11px",
          {
            "lineHeight": "14px",
            "letterSpacing": "0.03em",
            "fontWeight": "600"
          }
        ],
        "label-lg": [
          "14px",
          {
            "lineHeight": "20px",
            "letterSpacing": "0.01em",
            "fontWeight": "500"
          }
        ],
        "headline-lg": [
          "32px",
          {
            "lineHeight": "40px",
            "letterSpacing": "-0.01em",
            "fontWeight": "700"
          }
        ],
        "body-lg": [
          "16px",
          {
            "lineHeight": "26px",
            "fontWeight": "400"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "22px",
            "fontWeight": "400"
          }
        ],
        "label-md": [
          "12px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0.02em",
            "fontWeight": "600"
          }
        ],
        "headline-md": [
          "24px",
          {
            "lineHeight": "32px",
            "letterSpacing": "-0.005em",
            "fontWeight": "600"
          }
        ]
      }
    }
  }
};
