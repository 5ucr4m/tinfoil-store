import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./ui";

export type MenuItem =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      icon?: ReactNode;
      hint?: string;
      onSelect?: () => void;
      submenu?: MenuItem[];
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
    };

type Open = (event: ReactMouseEvent | { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void;

const MenuContext = createContext<Open>(() => {});

/** Right-click menu: `const open = useContextMenu(); <div onContextMenu={(e) => open(e, items)} />`. */
export const useContextMenu = () => useContext(MenuContext);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const open = useCallback<Open>((event, items) => {
    event.preventDefault?.();
    setState({ x: event.clientX, y: event.clientY, items });
  }, []);
  const close = useCallback(() => setState(null), []);

  return (
    <MenuContext.Provider value={open}>
      {children}
      {createPortal(
        <AnimatePresence>
          {state && <Menu key={`${state.x}-${state.y}`} x={state.x} y={state.y} items={state.items} onClose={close} root />}
        </AnimatePresence>,
        document.body,
      )}
    </MenuContext.Provider>
  );
}

function Menu({
  x,
  y,
  items,
  onClose,
  root,
  onBack,
  flipX,
}: {
  x: number;
  y: number;
  /** Submenus: left edge of the parent row, used when there is no room on the right. */
  flipX?: number;
  items: MenuItem[];
  onClose: () => void;
  root?: boolean;
  /** Submenus: ArrowLeft returns focus to the parent. */
  onBack?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [active, setActive] = useState(-1);
  const [sub, setSub] = useState<{ index: number; x: number; y: number; flipX: number } | null>(null);
  const selectable = items.map((it, i) => (!it.separator && !it.disabled ? i : -1)).filter((i) => i >= 0);

  // Keep the menu on screen: flip left/up when it would overflow.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y;
    if (left + width > window.innerWidth - margin) left = flipX !== undefined ? flipX - width + 4 : x - width;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - height - margin);
    setPos({ left: Math.max(margin, left), top: Math.max(margin, top) });
  }, [x, y, flipX]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (!root) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-context-menu]")) onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [root, onClose]);

  const openSub = (index: number) => {
    const row = ref.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!row) return;
    const r = row.getBoundingClientRect();
    const menu = ref.current!.getBoundingClientRect();
    setSub({ index, x: menu.right - 4, y: r.top - 5, flipX: menu.left });
  };

  const activate = (index: number) => {
    const item = items[index];
    if (!item || item.separator || item.disabled) return;
    if (item.submenu) return openSub(index);
    item.onSelect?.();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (sub) return;
    const pos = selectable.indexOf(active);
    if (e.key === "ArrowDown") setActive(selectable[(pos + 1) % selectable.length]);
    else if (e.key === "ArrowUp") setActive(selectable[(pos - 1 + selectable.length) % selectable.length]);
    else if (e.key === "Enter" || e.key === " " || (e.key === "ArrowRight" && !items[active]?.separator && (items[active] as { submenu?: MenuItem[] })?.submenu))
      activate(active);
    else if (e.key === "Escape") onClose();
    else if (e.key === "ArrowLeft" && onBack) onBack();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <motion.div
        ref={ref}
        data-context-menu
        role="menu"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.08 } }}
        transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ left: pos.left, top: pos.top, transformOrigin: "top left" }}
        className="fixed z-[80] min-w-56 max-w-80 rounded-xl border border-line bg-raised/95 p-1 shadow-2xl backdrop-blur-md focus:outline-none"
      >
        {items.map((item, i) =>
          item.separator ? (
            <div key={i} className="mx-2 my-1 h-px bg-line" role="separator" />
          ) : (
            <button
              key={i}
              data-index={i}
              role={item.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
              aria-checked={item.checked}
              aria-haspopup={item.submenu ? "menu" : undefined}
              aria-expanded={item.submenu ? sub?.index === i : undefined}
              disabled={item.disabled}
              onMouseEnter={() => {
                setActive(i);
                if (item.submenu) openSub(i);
                else setSub(null);
              }}
              onClick={() => activate(i)}
              className={cx(
                "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors disabled:opacity-40",
                item.danger ? "text-danger" : "text-ink",
                active === i && (item.danger ? "bg-danger-soft" : "bg-signal-soft"),
              )}
            >
              <span className="grid size-4 shrink-0 place-items-center text-mute [&_svg]:size-4">
                {item.checked !== undefined ? item.checked && <Check className="text-signal" /> : item.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && <span className="data shrink-0 text-[10px] text-faint">{item.hint}</span>}
              {item.submenu && <ChevronRight className="size-3.5 shrink-0 text-faint" />}
            </button>
          ),
        )}
      </motion.div>
      <AnimatePresence>
        {sub && !items[sub.index]?.separator && (items[sub.index] as { submenu?: MenuItem[] }).submenu && (
          <Menu
            key={sub.index}
            x={sub.x}
            y={sub.y}
            flipX={sub.flipX}
            items={(items[sub.index] as { submenu: MenuItem[] }).submenu}
            onClose={onClose}
            onBack={() => {
              setSub(null);
              ref.current?.focus();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
