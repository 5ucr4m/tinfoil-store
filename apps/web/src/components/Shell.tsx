import { AnimatePresence, motion } from "motion/react";
import { Gamepad2, Library, LogOut, Monitor, Moon, Plug, ShieldCheck, Sun, Upload, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { bytes } from "../lib/format";
import { useSession } from "../lib/session";
import { useTheme, type ThemePref } from "../lib/theme";
import { isActive, useUploads } from "../lib/uploads";
import type { Transfer } from "../lib/api";
import { Pins } from "./Cartridge";
import { RoleMark, roleLabel } from "./RoleMark";
import { isRunning as isTransferRunning, transferSpeed, useTransfers } from "./Transfers";
import { LanguageSwitch } from "./LanguageSwitch";
import { cx } from "./ui";

const NAV: {
  to: string;
  label: MessageKey;
  short?: MessageKey;
  icon: typeof Library;
  admin?: true;
  /** The sidebar shows the account as a chip instead; the phone has no room for one. */
  phoneOnly?: true;
}[] = [
  { to: "/", label: "shell.nav.library", icon: Library },
  { to: "/upload", label: "shell.nav.upload", icon: Upload, admin: true },
  { to: "/integrations", label: "shell.nav.integrations", icon: Plug, admin: true },
  { to: "/access", label: "shell.nav.access", icon: ShieldCheck, admin: true },
  { to: "/connect", label: "shell.nav.tinfoil", short: "shell.nav.tinfoilShort", icon: Gamepad2 },
  { to: "/account", label: "shell.nav.account", icon: UserRound, phoneOnly: true },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <path d="M7 3h13l5 5v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--shell)" />
        <rect x="8" y="10" width="14" height="13" rx="1.5" fill="var(--signal)" />
        <g fill="var(--pin)">
          {[8, 11, 14, 17].map((x) => (
            <rect key={x} x={x} y="5" width="1.6" height="2.6" rx=".4" />
          ))}
        </g>
      </svg>
      <span className="display text-[19px] tracking-[-0.01em]">Cartucho</span>
    </span>
  );
}

function ThemeSwitch() {
  const { pref, setTheme } = useTheme();
  const { t } = useI18n();
  const options: { value: ThemePref; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: t("common.theme.light") },
    { value: "system", icon: Monitor, label: t("common.theme.system") },
    { value: "dark", icon: Moon, label: t("common.theme.dark") },
  ];
  return (
    <div className="relative flex rounded-xl border border-line bg-panel p-0.5" role="radiogroup" aria-label={t("common.theme.label")}>
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cx(
            "relative grid h-7 w-8 place-items-center rounded-[10px] transition-colors",
            pref === value ? "text-ink" : "text-faint hover:text-mute",
          )}
        >
          {pref === value && (
            <motion.span
              layoutId="theme-pill"
              className="absolute inset-0 rounded-[10px] bg-raised shadow-card"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <Icon className="relative size-3.5" />
        </button>
      ))}
    </div>
  );
}

/** Persistent transfer readout, visible from any page while uploads run. */
/** Browser uploads plus server copies/moves, as one meter visible from every page. */
function TransferDock({ transfers }: { transfers: Transfer[] }) {
  const { t } = useI18n();
  const uploads = useUploads();
  const running = uploads.filter((u) => isActive(u.state) || u.state === "queued");
  const serverRunning = transfers.filter(isTransferRunning);
  const count = running.length + serverRunning.length;
  const total = running.reduce((s, u) => s + u.size, 0) + serverRunning.reduce((s, x) => s + x.size, 0);
  const sent = running.reduce((s, u) => s + u.sent, 0) + serverRunning.reduce((s, x) => s + x.copied, 0);
  const speed = running.reduce((s, u) => s + u.speed, 0) + serverRunning.reduce((s, x) => s + transferSpeed(x), 0);
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
        >
          <NavLink
            to="/upload"
            className="block rounded-2xl bg-raised p-3 text-ink ring-1 ring-line transition-transform hover:-translate-y-0.5 dark:bg-shell dark:text-white dark:ring-shell-edge"
          >
            <div className="flex items-baseline justify-between">
              <span className="eyebrow dark:!text-white/60">{t("shell.dock.writing", { count })}</span>
              <span className="data text-[11px] text-pin">{total ? Math.floor((sent / total) * 100) : 0}%</span>
            </div>
            <Pins progress={total ? sent / total : 0} active count={14} className="mt-2" />
            <p className="data mt-2 text-[10px] text-mute dark:text-white/55">{bytes(speed)}/s</p>
          </NavLink>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Who you are and what that allows, said once in the chrome. The write-protect mark
 * carries the role, so no button has to explain itself.
 */
function AccountChip() {
  const { t } = useI18n();
  const { user } = useSession();
  const tone = user.role === "admin" ? "text-signal" : "text-mute";
  return (
    <NavLink
      to="/account"
      title={t("shell.account")}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-2.5 rounded-2xl border bg-raised px-3 py-2.5 shadow-card transition-transform hover:-translate-y-0.5",
          isActive ? "border-signal/60" : "border-line",
        )
      }
    >
      <RoleMark role={user.role} className={cx("size-4", tone)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{user.username}</span>
        <span className="eyebrow block text-[9px]">{t(roleLabel(user.role))}</span>
      </span>
    </NavLink>
  );
}

export function Shell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const { t } = useI18n();
  const { isAdmin } = useSession();
  const location = useLocation();
  const nav = NAV.filter((item) => !item.admin || isAdmin);
  const sidebarNav = nav.filter((item) => !item.phoneOnly);
  const uploads = useUploads();
  // Polls server transfers while any runs and raises done/failed toasts on every page.
  const transfers = useTransfers({ notify: true });
  const activeCount =
    uploads.filter((u) => isActive(u.state) || u.state === "queued").length + transfers.filter(isTransferRunning).length;

  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    onLogout();
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-panel/60 px-4 py-6 md:flex">
        <div className="px-2">
          <Wordmark />
        </div>
        <nav className="mt-10 flex flex-col gap-1" aria-label={t("shell.nav.label")}>
          {sidebarNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cx(
                  "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                  isActive ? "font-semibold text-ink" : "text-mute hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl border border-line bg-raised shadow-card"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon className={cx("relative size-[18px]", isActive && "text-signal")} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="relative">{t(label)}</span>
                  {to === "/upload" && activeCount > 0 && (
                    <span className="data relative ml-auto rounded-md bg-pin px-1.5 text-[10px] leading-5 font-semibold text-shell">
                      {activeCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <TransferDock transfers={transfers} />
          <div className="flex flex-col gap-2 px-1">
            <AccountChip />
            <LanguageSwitch />
            <div className="flex items-center justify-between">
              <ThemeSwitch />
              <button
                onClick={logout}
                className="grid size-9 place-items-center rounded-xl text-mute transition-colors hover:bg-raised hover:text-ink"
                aria-label={t("shell.signOut")}
                title={t("shell.signOut")}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/85 px-4 py-3 backdrop-blur md:hidden">
        <Wordmark />
        <div className="flex items-center gap-1">
          <LanguageSwitch variant="compact" />
          <ThemeSwitch />
          <button onClick={logout} className="grid size-9 place-items-center rounded-xl text-mute" aria-label={t("shell.signOut")}>
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      <main className="min-w-0 px-4 pt-8 pb-28 sm:px-8 md:pt-12 md:pb-16 lg:px-12">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          // The library grid uses the full width; forms and settings stay at a readable measure.
          className={cx("mx-auto", location.pathname === "/" ? "max-w-none" : "max-w-6xl")}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label={t("shell.nav.label")}
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map(({ to, label, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cx(
                "relative flex min-w-0 flex-col items-center gap-1 px-0.5 py-2.5 text-[10px]",
                isActive ? "text-signal" : "text-mute",
              )
            }
          >
            <Icon className="size-5" strokeWidth={1.9} />
            {/* Six destinations fit on a phone only if the longest label can clip instead of collide. */}
            <span className="max-w-full truncate">{t(short ?? label)}</span>
            {to === "/upload" && activeCount > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-18px)] size-2 rounded-full bg-pin" />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
