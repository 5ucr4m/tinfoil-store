import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Copy, Loader2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-signal text-signal-ink hover:brightness-110 shadow-[0_6px_20px_-8px_var(--signal)]",
    secondary: "bg-raised text-ink border border-line hover:border-faint shadow-card",
    ghost: "text-mute hover:text-ink hover:bg-raised/70",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap",
        "transition-[transform,background-color,color,border-color,filter] duration-150 active:scale-[0.97]",
        "disabled:opacity-50 disabled:active:scale-100",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        "h-10 w-full rounded-xl border border-line bg-raised px-3 text-sm text-ink placeholder:text-faint",
        "transition-[border-color,box-shadow] focus:border-signal focus:shadow-[0_0_0_3px_var(--signal-soft)] focus:outline-none",
        className,
      )}
    />
  );
}

/** Native select with our own chevron, inset by the same 12px as the text on the left. */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx("relative", className)}>
      <select
        {...rest}
        className={cx(
          "h-10 w-full cursor-pointer appearance-none rounded-xl border border-line bg-raised pr-9 pl-3 text-sm text-ink",
          "transition-[border-color,box-shadow] hover:border-faint focus:border-signal focus:shadow-[0_0_0_3px_var(--signal-soft)] focus:outline-none",
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-mute" />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs leading-relaxed text-mute">{hint}</p>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-signal" : "bg-line",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 35 }}
        className={cx("absolute top-1 size-4 rounded-full bg-white shadow", checked ? "right-1" : "left-1")}
      />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-4 animate-spin text-mute", className)} />;
}

export function StatusDot({ status }: { status: "ok" | "error" | "pending" | "syncing" }) {
  const color = {
    ok: "bg-ok",
    error: "bg-danger",
    pending: "bg-pin",
    syncing: "bg-signal",
  }[status];
  return (
    <span className="relative inline-flex size-2.5">
      {status === "syncing" && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-60", color)} />}
      <span className={cx("relative inline-flex size-2.5 rounded-full", color)} />
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "signal" | "ok" | "danger" | "pin" }) {
  const tones = {
    neutral: "bg-panel text-mute border-line",
    signal: "bg-signal-soft text-signal border-transparent",
    ok: "bg-ok-soft text-ok border-transparent",
    danger: "bg-danger-soft text-danger border-transparent",
    pin: "bg-pin-dim text-ink border-transparent",
  };
  return (
    <span className={cx("data inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function CopyField({
  value,
  label,
  secret,
  display,
}: {
  value: string;
  label?: string;
  secret?: boolean;
  /** Shown instead of the value (e.g. grouped for reading). The copy button always copies `value`. */
  display?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="group flex min-w-0 items-center gap-1 rounded-xl border border-line bg-panel py-1 pr-1 pl-3">
      {label && <span className="eyebrow mr-2 shrink-0">{label}</span>}
      <button
        type="button"
        onClick={() => setShown(true)}
        className="data min-w-0 flex-1 truncate text-left text-[12px] text-ink"
        title={shown ? value : "Mostrar"}
      >
        {shown ? (display ?? value) : "•".repeat(Math.min(value.length, 19))}
      </button>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copiar ${label ?? "valor"}`}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-raised hover:text-ink"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="ok" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
              <Check className="size-4 text-ok" />
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
              <Copy className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] dark:bg-black/60" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cx(
              "relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-raised shadow-2xl sm:rounded-3xl",
              wide ? "sm:max-w-2xl" : "sm:max-w-lg",
            )}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-raised/90 px-6 py-4 backdrop-blur">
              <h2 className="display-narrow text-xl">{title}</h2>
              <button onClick={onClose} aria-label="Fechar" className="grid size-8 place-items-center rounded-lg text-mute hover:bg-panel hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/25 dark:bg-black/55" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-panel shadow-2xl"
          >
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-4 right-4 z-10 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
            >
              <X className="size-4" />
            </button>
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function useEscape(active: boolean, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && ref.current();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/* ---------- Toasts ---------- */

interface Toast {
  id: number;
  tone: "ok" | "error" | "info";
  message: string;
}

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
              className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-ink shadow-xl"
            >
              <span
                className={cx(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  t.tone === "ok" ? "bg-ok" : t.tone === "error" ? "bg-danger" : "bg-signal",
                )}
              />
              <span className="leading-snug">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-[clamp(2rem,5vw,3.25rem)]">{title}</h1>
        {meta && <div className="mt-3 text-sm text-mute">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display-narrow text-xl">{title}</h2>
          {description && <p className="mt-1 max-w-prose text-sm text-mute">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
