import { HardDrive } from "lucide-react";
import { translate } from "../i18n";
import type { IntegrationType } from "../lib/api";
import { cx } from "./ui";

export function ProviderIcon({ type, className }: { type: IntegrationType; className?: string }) {
  if (type === "gdrive") {
    return (
      <svg viewBox="0 0 24 24" className={cx("size-5", className)} aria-hidden>
        <path d="M8.2 3h7.6l6.2 10.8-3.8 6.6L12 9.6z" fill="#FFBA00" />
        <path d="M8.2 3 2 13.8l3.8 6.6L12 9.6z" fill="#0F9D58" />
        <path d="M5.8 20.4h12.4l3.8-6.6H9.6z" fill="#4285F4" />
      </svg>
    );
  }
  if (type === "s3") {
    return (
      <svg viewBox="0 0 24 24" className={cx("size-5", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
        <ellipse cx="12" cy="5.5" rx="8" ry="2.5" />
        <path d="M4 5.5 5.6 19c.2 1.4 3 2.5 6.4 2.5s6.2-1.1 6.4-2.5L20 5.5" />
        <path d="M4.6 10.5c1 1.2 4 2 7.4 2s6.4-.8 7.4-2" opacity=".5" />
      </svg>
    );
  }
  return <HardDrive className={cx("size-5", className)} strokeWidth={1.8} />;
}

/** Provider name in the current language. Components re-render on language change via the app root. */
export const providerLabel = (type: IntegrationType) => translate(`common.provider.${type}`);
