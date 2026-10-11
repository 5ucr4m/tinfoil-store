import { motion } from "motion/react";
import { useState } from "react";
import { cx } from "./ui";

/**
 * The signature element: a game card with a chamfered corner and a row of
 * gold contacts. Contacts double as the progress meter while a file is written.
 */

const CHAMFER = "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)";

function hue(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function Pins({
  progress,
  count = 10,
  active,
  className,
  size = "md",
}: {
  progress: number;
  count?: number;
  active?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const lit = Math.floor(progress * count + 1e-9);
  const dims = { sm: "h-2 w-1", md: "h-3 w-[5px]", lg: "h-5 w-2" }[size];
  return (
    <div
      className={cx("flex items-end gap-[3px]", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      {Array.from({ length: count }, (_, i) => {
        const on = i < lit;
        const current = active && i === lit && progress < 1;
        return (
          <span
            key={i}
            className={cx(
              "rounded-[1.5px] transition-[background-color,box-shadow] duration-300",
              dims,
              on ? "bg-pin shadow-[0_0_6px_-1px_var(--pin)]" : "bg-pin-dim",
            )}
            style={current ? { background: "var(--pin)", animation: "pin-pulse 0.9s ease-in-out infinite" } : undefined}
          />
        );
      })}
    </div>
  );
}

/** Square label art, or a generated label when the title is unknown. */
export function LabelArt({ src, name, seed, className }: { src?: string | null; name: string; seed: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const h = hue(seed);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cx("size-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cx("relative flex size-full items-end overflow-hidden p-2.5", className)}
      style={{
        background: `linear-gradient(150deg, oklch(0.72 0.13 ${h}) 0%, oklch(0.5 0.16 ${(h + 40) % 360}) 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage: "repeating-linear-gradient(-45deg, #fff 0 2px, transparent 2px 9px)",
        }}
      />
      <span className="display-narrow relative line-clamp-3 text-[15px] leading-[1.05] text-white drop-shadow-sm">
        {name}
      </span>
    </div>
  );
}

export function Cartridge({
  title,
  art,
  seed,
  meta,
  progress,
  active,
  onClick,
  badges,
}: {
  title: string;
  art?: string | null;
  seed: string;
  meta?: string;
  progress?: number;
  active?: boolean;
  onClick?: () => void;
  badges?: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -6, rotate: -0.6 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className="group relative block w-full text-left focus-visible:outline-none"
    >
      <div
        className="relative rounded-[12px] bg-shell p-2 pt-0 shadow-[0_14px_28px_-16px_rgb(0_0_0/0.55)] ring-1 ring-shell-edge transition-shadow group-hover:shadow-[0_22px_36px_-18px_rgb(0_0_0/0.6)] group-focus-visible:ring-2 group-focus-visible:ring-signal"
        style={{ clipPath: CHAMFER }}
      >
        <div className="flex h-5 items-center justify-between pr-5 pl-0.5">
          <Pins progress={progress ?? 1} active={active} size="sm" count={8} />
          <span className="h-1 w-5 rounded-full bg-shell-edge" />
        </div>
        <div className="relative aspect-square overflow-hidden rounded-[7px] bg-raised">
          <LabelArt src={art} name={title} seed={seed} />
          {badges && <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">{badges}</div>}
        </div>
        <div className="px-0.5 pt-2.5 pb-1">
          <p className="display-narrow line-clamp-2 min-h-[2.1em] text-[14px] text-white">{title}</p>
          {meta && <p className="data mt-1 truncate text-[10px] text-white/55">{meta}</p>}
        </div>
        {/* Grip ridges along the bottom edge */}
        <div className="flex justify-center gap-1 pb-0.5" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="h-[3px] w-4 rounded-full bg-shell-edge" />
          ))}
        </div>
      </div>
    </motion.button>
  );
}
