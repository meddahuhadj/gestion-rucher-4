import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { LOCALES, type Locale } from "@moumen/shared";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

export const RTL_LOCALES: Locale[] = ["ar"];

/** Noms de langues dans leur propre écriture — pour le sélecteur (§38). */
export const LOCALE_LABEL: Record<Locale, string> = {
  ar: "العربية",
  fr: "Français",
  en: "English",
};

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: (localStorage.getItem("moumen.locale") as Locale) ?? "fr",
  fallbackLng: "fr",
  supportedLngs: LOCALES as unknown as string[],
  interpolation: { escapeValue: false },
});

export function applyLocale(locale: Locale) {
  void i18n.changeLanguage(locale);
  localStorage.setItem("moumen.locale", locale);
  const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
  document.documentElement.setAttribute("lang", locale);
  document.documentElement.setAttribute("dir", dir);
}

export default i18n;
