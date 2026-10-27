import { useI18n, type MessageKey } from "../i18n";
import type { Role } from "../lib/api";
import { cx } from "./ui";

/**
 * The write-protect notch. Cartridges and floppies carry a physical cut-out that decides
 * whether the medium accepts writes, which is exactly what the two roles are: an admin's
 * notch is open, a read-only account's is plugged by a tab. Always shown next to the word.
 */
export function RoleMark({ role, className }: { role: Role; className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={cx("shrink-0", className)} aria-hidden>
      <path
        d={role === "admin" ? "M9 2 11.5 4.5V12H3V9.3M3 6.7V2h6" : "M9 2 11.5 4.5V12H3V2Z"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {role === "user" && <rect x="1.4" y="6.6" width="3.3" height="2.8" rx="0.7" fill="currentColor" />}
    </svg>
  );
}

export const roleLabel = (role: Role): MessageKey => (role === "admin" ? "common.roles.admin" : "common.roles.user");

/** Mark plus word. The mark is never shown on its own. */
export function RoleTag({ role, className }: { role: Role; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cx("inline-flex items-center gap-1.5", className)}>
      <RoleMark role={role} className={cx("size-3.5", role === "admin" ? "text-signal" : "text-mute")} />
      {t(roleLabel(role))}
    </span>
  );
}
