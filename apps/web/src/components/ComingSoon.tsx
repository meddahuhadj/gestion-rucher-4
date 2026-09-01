import { useTranslation } from "react-i18next";

export function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <div className="text-4xl">🐝</div>
      <h1 className="mt-3 font-display text-2xl font-semibold">{t(titleKey)}</h1>
      <p className="label-mono mt-2">{t("common.comingSoon")}</p>
      <p className="mt-3 text-sm text-ink-soft">{t("common.comingSoonBody")}</p>
    </div>
  );
}
