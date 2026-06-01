/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    blue: '#1d559a',
                    navy: '#0e254e',
                    gray: '#dfe1e7',
                },
                scorecard: {
                    red: '#e05252',
                    yellow: '#f5c518',
                    green: '#4caf72',
                    neutral: '#f0f2f5',
                    'cell-text': '#1a1a1a',
                },
                app: {
                    bg: '#f0f2f5',
                    surface: '#ffffff',
                    'surface-2': '#f8f9fb',
                    'surface-alt': '#fafbfc',
                    text: '#1a1a2e',
                    muted: '#6b7280',
                    border: '#e2e6ea',
                    'border-strong': '#c8cfd8',
                    accent: '#3b6ff0',
                }
            },
        },
    },
    plugins: [],
}
