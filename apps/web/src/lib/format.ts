import { useSessionStore } from "@/store/session";
import { usePrefsStore } from "@/store/prefs";

/** Étiquette de locale pour Intl — l'arabe algérien utilise les chiffres latins. */
const intlLocale = (l: string) => (l === "ar" ? "ar-DZ" : l);

export function fmtDate(value: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const l = useSessionStore.getState().locale;
  return new Date(value).toLocaleDateString(intlLocale(l), opts);
}

export function fmtNum(n: number, opts?: Intl.NumberFormatOptions) {
  const l = useSessionStore.getState().locale;
  return new Intl.NumberFormat(intlLocale(l), {
    numberingSystem: "latn",
    ...opts,
  }).format(n);
}

const KG_TO_LB = 2.2046226218;

/** Montant dans la devise choisie (§18/§38). Repli « 1 234 XXX » si code non ISO. */
export function fmtMoney(n: number) {
  const { currency } = usePrefsStore.getState();
  const l = useSessionStore.getState().locale;
  try {
    return new Intl.NumberFormat(intlLocale(l), {
      numberingSystem: "latn",
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${fmtNum(n, { maximumFractionDigits: 0 })} ${currency}`;
  }
}

/** Poids : reçoit toujours des kilogrammes, affiche selon l'unité choisie. */
export function fmtWeight(kg: number) {
  const { weightUnit } = usePrefsStore.getState();
  return weightUnit === "lb"
    ? `${fmtNum(kg * KG_TO_LB, { maximumFractionDigits: 1 })} lb`
    : `${fmtNum(kg, { maximumFractionDigits: 1 })} kg`;
}

/** Température : reçoit toujours des °C, affiche selon l'unité choisie. */
export function fmtTemp(celsius: number) {
  const { tempUnit } = usePrefsStore.getState();
  return tempUnit === "f"
    ? `${fmtNum(celsius * 1.8 + 32, { maximumFractionDigits: 0 })} °F`
    : `${fmtNum(celsius, { maximumFractionDigits: 0 })} °C`;
}

/** @deprecated conservés pour compat — préférer fmtMoney / fmtWeight. */
export const fmtDzd = fmtMoney;
export const fmtKg = fmtWeight;
