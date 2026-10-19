import daisyui from "daisyui";
import containerQueries from "@tailwindcss/container-queries";
import colors from "tailwindcss/colors";

const baseColor = (variable) => `color-mix(in srgb, var(${variable}) calc(100% * <alpha-value>), transparent)`;

// Brand ramp driven by CSS variables (see App.css) so it flips between light and dark mode.
// Replaces the fork's blue/indigo/sky accents with Proxymateur's ink-and-paper identity.
const brand = Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, `rgb(var(--brand-${n}) / <alpha-value>)`])
);

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                // Windows-only target: Segoe UI Variable ships with Windows 11 (Segoe UI on 10); no download.
                sans: ['"Segoe UI Variable Text"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
                mono: ['"Cascadia Mono"', 'Consolas', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                // Sharper corners than the upstream fork (was 12/16/24px).
                xl: '0.5rem',
                '2xl': '0.625rem',
                '3xl': '0.75rem',
            },
            colors: {
                'base-100': baseColor('--color-base-100'),
                'base-200': baseColor('--color-base-200'),
                'base-300': baseColor('--color-base-300'),
                'base-content': baseColor('--color-base-content'),
                // Neutral greys instead of the cool blue-greys.
                gray: colors.neutral,
                slate: colors.neutral,
                zinc: colors.neutral,
                // Fork accents remapped to the brand ramp.
                blue: brand,
                indigo: brand,
                sky: brand,
                // Decorative rainbow accents fold into the brand ramp; status colours
                // (emerald/green, amber/yellow/orange, red/rose) stay untouched.
                purple: brand,
                violet: brand,
                cyan: brand,
                teal: brand,
                fuchsia: brand,
                pink: brand,
                brand,
                lime: { ...colors.lime, signal: '#C6FF3D' },
            },
        },
    },
    plugins: [daisyui, containerQueries],
    daisyui: {
        themes: [
            {
                light: {
                    "primary": "#0A0A0A",
                    "primary-content": "#FAFAF7",
                    "secondary": "#525252",
                    "accent": "#C6FF3D",
                    "accent-content": "#0A0A0A",
                    "neutral": "#0A0A0A",
                    "base-100": "#FFFFFF",
                    "base-200": "#F4F4F1",
                    "base-300": "#E3E3DE",
                    "base-content": "#0A0A0A",
                    "info": "#0ea5e9",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                    "--radius-selector": "0.25rem",
                    "--radius-field": "0.25rem",
                    "--radius-box": "0.5rem",
                },
            },
            {
                dark: {
                    "primary": "#EDEDE8",
                    "primary-content": "#0A0A0A",
                    "secondary": "#A3A3A3",
                    "accent": "#C6FF3D",
                    "accent-content": "#0A0A0A",
                    "neutral": "#1C1C1C",
                    "base-100": "#0B0B0B",
                    "base-200": "#151515",
                    "base-300": "#262626",
                    "base-content": "#EDEDE8",
                    "info": "#0ea5e9",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                    "--radius-selector": "0.25rem",
                    "--radius-field": "0.25rem",
                    "--radius-box": "0.5rem",
                },
            },
        ],
        darkTheme: "dark",
    },
}
