import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

// English-only build: only the English bundle is loaded; other locale files
// remain on disk but are intentionally not imported/bundled.
i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: en,
            },
        },
        lng: "en",
        fallbackLng: "en",
        debug: false,

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
    });

export default i18n;
