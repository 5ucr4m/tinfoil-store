import { motion } from "motion/react";
import { ChevronDown, Languages } from "lucide-react";
import { LOCALES, useI18n } from "../i18n";
import { useContextMenu } from "./ContextMenu";
import { cx } from "./ui";

/**
 * Language picker. "segmented" sits in the sidebar next to the theme switch and shares
 * its sliding pill; "compact" is a single button for tight spots (mobile bar, sign-in).
 */
export function LanguageSwitch({ variant = "segmented", className }: { variant?: "segmented" | "compact"; className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const openMenu = useContextMenu();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  if (variant === "compact") {
    return (
      <button
        type="button"
        aria-label={`${t("common.language.label")}: ${current.name}`}
        title={t("common.language.label")}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          openMenu(
            { clientX: rect.left, clientY: rect.bottom + 6 },
            LOCALES.map((l) => ({
              label: l.name,
              hint: l.short,
              checked: l.code === locale,
              onSelect: () => setLocale(l.code),
            })),
          );
        }}
        className={cx(
          "data inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-panel px-2.5 text-[11px] font-medium text-ink transition-colors hover:border-faint",
          className,
        )}
      >
        <Languages className="size-3.5 text-mute" />
        {current.short}
        <ChevronDown className="size-3 text-faint" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("common.language.label")}
      className={cx("relative flex rounded-xl border border-line bg-panel p-0.5", className)}
    >
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={l.code === locale}
          lang={l.code}
          title={l.name}
          onClick={() => setLocale(l.code)}
          className={cx(
            "data relative h-7 flex-1 rounded-[10px] px-2 text-[11px] font-medium tracking-wide transition-colors",
            l.code === locale ? "text-ink" : "text-faint hover:text-mute",
          )}
        >
          {l.code === locale && (
            <motion.span
              layoutId="language-pill"
              className="absolute inset-0 rounded-[10px] bg-raised shadow-card"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative">{l.short}</span>
        </button>
      ))}
    </div>
  );
}
