import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { api, type Integration, type Transfer } from "../lib/api";
import { useSession } from "../lib/session";
import { bytes, duration } from "../lib/format";
import { Pins } from "./Cartridge";
import { ProviderIcon } from "./ProviderIcon";
import { Badge, Button, cx, Spinner, useToast } from "./ui";

export const isRunning = (t: Transfer) => t.state !== "done" && t.state !== "error" && t.state !== "canceled";

/** Average speed since bytes started flowing, in bytes per second. */
export const transferSpeed = (t: Transfer) =>
  t.state === "copying" && t.copyStartedAt ? t.copied / Math.max((Date.now() - t.copyStartedAt) / 1000, 1) : 0;

/** Server-side moves. Polls while any is running and refreshes the library when one lands. */
export function useTransfers({ notify = false } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t: tr } = useI18n();
  const { isAdmin } = useSession();
  const query = useQuery({
    queryKey: ["transfers"],
    queryFn: () => api<{ transfers: Transfer[] }>("/files/transfers"),
    refetchInterval: (q) => (q.state.data?.transfers.some(isRunning) ? 1000 : false),
    // Only an admin can start one, so don't ask on every page load for everyone else.
    enabled: isAdmin,
  });
  const seen = useRef(new Map<string, Transfer["state"]>());
  useEffect(() => {
    if (!notify) return;
    for (const t of query.data?.transfers ?? []) {
      const before = seen.current.get(t.id);
      seen.current.set(t.id, t.state);
      if (!before || before === t.state || isRunning(t)) continue;
      if (t.state === "done") toast(tr("transfers.done", { name: t.name, to: t.toName }));
      else if (t.state === "canceled") toast(tr("transfers.canceledToast", { name: t.name }), "info");
      else toast(tr(t.mode === "copy" ? "transfers.copyFailed" : "transfers.moveFailed", { name: t.name, error: t.error ?? "" }), "error");
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [query.data, qc, toast, notify, tr]);
  return query.data?.transfers ?? [];
}

export function useMove() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ fileId, integrationId, mode = "move" }: { fileId: string; integrationId: string; mode?: "move" | "copy" }) =>
      api<{ transfer: Transfer }>(`/files/${fileId}/move`, { method: "POST", json: { integrationId, mode } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["transfers"] }),
    onError: (e) => toast(e.message, "error"),
  });
}

export function useDestinations() {
  // Destinations are the admin's business; read-only accounts never move or upload files.
  const { isAdmin } = useSession();
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<{ integrations: Integration[] }>("/integrations"),
    enabled: isAdmin,
  });
}

/** Destination list for "Move to" / "Copy to". */
export function MoveTargets({
  exclude = [],
  onPick,
  disabled,
}: {
  exclude?: string[];
  onPick: (i: Integration) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const destinations = useDestinations();
  const options = (destinations.data?.integrations ?? []).filter((i) => !exclude.includes(i.id) && i.status !== "pending");
  if (!options.length) return <p className="text-[13px] text-mute">{t("transfers.noTargets")}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((i) => (
        <button
          key={i.id}
          disabled={disabled}
          onClick={() => onPick(i)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-[13px] transition-colors hover:border-signal disabled:opacity-50"
        >
          <ProviderIcon type={i.type} className="size-4" />
          {i.name}
        </button>
      ))}
    </div>
  );
}

export function TransferProgress({ transfer: t, className }: { transfer: Transfer; className?: string }) {
  const { t: tr } = useI18n();
  const progress = t.size ? t.copied / t.size : 0;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-3">
        <Pins progress={progress} active={t.state === "copying"} count={20} />
        <span className="data text-[11px]">{Math.floor(progress * 100)}%</span>
      </div>
      <p className="data text-[10.5px] text-mute">
        {t.state === "queued" && tr("transfers.queued", { to: t.toName })}
        {t.state === "copying" &&
          tr(t.mode === "copy" ? "transfers.copying" : "transfers.moving", {
            to: t.toName,
            done: bytes(t.copied),
            total: bytes(t.size),
          })}
        {t.state === "finishing" && tr("transfers.finishing", { to: t.toName })}
      </p>
    </div>
  );
}

/** Server-side copies and moves, with progress, cancel and history. Shown on the upload page. */
export function TransferQueue() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const transfers = useTransfers();
  const destinations = useDestinations().data?.integrations ?? [];
  const typeOf = (id: string) => destinations.find((d) => d.id === id)?.type ?? "local";

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/files/transfers/${id}/cancel`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["transfers"] }),
    onError: (e) => toast(e.message, "error"),
  });
  const clear = useMutation({
    mutationFn: () => api<{ transfers: Transfer[] }>("/files/transfers/finished", { method: "DELETE" }),
    onSuccess: (data) => qc.setQueryData(["transfers"], data),
  });

  if (!transfers.length) return null;
  const running = transfers.filter(isRunning);
  const total = running.reduce((s, x) => s + x.size, 0);
  const done = running.reduce((s, x) => s + x.copied, 0);
  const speed = running.reduce((s, x) => s + transferSpeed(x), 0);

  return (
    <section className="mt-10" id="transfers">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display-narrow text-2xl">{t("transfers.queue.title")}</h2>
          {running.length > 0 && (
            <p className="data mt-1 text-[12px] text-mute">
              {t("transfers.queue.summary", {
                done: bytes(done),
                total: bytes(total),
                speed: bytes(speed),
                remaining: speed > 0 ? duration((total - done) / speed) : t("transfers.queue.calculating"),
              })}
            </p>
          )}
        </div>
        {transfers.length > running.length && (
          <Button size="sm" variant="ghost" onClick={() => clear.mutate()} loading={clear.isPending}>
            {t("transfers.queue.clearFinished")}
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {transfers.map((x) => {
            const progress = x.size ? x.copied / x.size : 0;
            const speedNow = transferSpeed(x);
            const stateKey = x.state === "copying" && x.mode === "move" ? "moving" : x.state;
            return (
              <motion.li
                key={x.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
                className={cx(
                  "flex items-center gap-4 rounded-2xl border bg-raised p-3 pr-4",
                  x.state === "error" ? "border-danger/40" : "border-line",
                )}
              >
                <div className="flex shrink-0 items-center gap-1 rounded-xl bg-panel px-2.5 py-3 text-mute">
                  <ProviderIcon type={typeOf(x.fromId)} className="size-4" />
                  <ArrowRight className="size-3.5" />
                  <ProviderIcon type={typeOf(x.toId)} className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium" title={x.name}>
                      {x.name}
                    </p>
                    <Badge tone={x.mode === "copy" ? "signal" : "neutral"}>{t(`transfers.queue.mode.${x.mode}`)}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Pins progress={x.state === "done" ? 1 : progress} active={x.state === "copying"} count={24} className="hidden sm:flex" />
                    <Pins progress={x.state === "done" ? 1 : progress} active={x.state === "copying"} count={12} className="sm:hidden" />
                    <span className="data text-[11px] text-ink">{Math.floor((x.state === "done" ? 1 : progress) * 100)}%</span>
                  </div>
                  <p className={cx("data mt-1.5 truncate text-[10.5px]", x.state === "error" ? "text-danger" : "text-mute")}>
                    {x.state === "error"
                      ? x.error
                      : x.state === "done"
                        ? t("transfers.queue.doneIn", { to: x.toName })
                        : x.state === "copying"
                          ? `${t(`transfers.queue.state.${stateKey}`)} · ${t("transfers.queue.progress", {
                              done: bytes(x.copied),
                              total: bytes(x.size),
                              speed: bytes(speedNow),
                              remaining: speedNow > 0 ? duration((x.size - x.copied) / speedNow) : t("transfers.queue.calculating"),
                            })}`
                          : `${t(`transfers.queue.state.${stateKey}`)} · ${x.fromName} → ${x.toName}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {x.state === "done" ? (
                    <span className="grid size-9 place-items-center text-ok">
                      <Check className="size-4" strokeWidth={2.5} />
                    </span>
                  ) : x.state === "finishing" ? (
                    <Spinner />
                  ) : isRunning(x) ? (
                    <button
                      onClick={() => cancel.mutate(x.id)}
                      disabled={cancel.isPending && cancel.variables === x.id}
                      aria-label={t("transfers.queue.cancel")}
                      title={t("transfers.queue.cancel")}
                      className="grid size-9 place-items-center rounded-xl text-mute transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
