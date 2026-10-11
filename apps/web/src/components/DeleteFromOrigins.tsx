import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { api, type IntegrationType, type LibraryFile } from "../lib/api";
import { bytes } from "../lib/format";
import { ProviderIcon } from "./ProviderIcon";
import { Button, cx, useToast } from "./ui";

interface Origin {
  id: string;
  name: string;
  type: IntegrationType;
  files: LibraryFile[];
  size: number;
}

/**
 * Chooses which destinations to delete from. Each destination holding these files is a
 * card; the summary spells out what disappears for good and what stays as a copy, and the
 * button names exactly what will happen. With several destinations nothing is preselected,
 * so a reflex click can't remove the wrong copy.
 */
export function DeleteFromOrigins({
  files,
  onCancel,
  onDone,
  compact,
}: {
  files: LibraryFile[];
  onCancel: () => void;
  onDone: () => void;
  /** Inline in a file row instead of a modal: tighter spacing. */
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();

  const origins = useMemo(() => {
    const map = new Map<string, Origin>();
    for (const f of files) {
      let o = map.get(f.integrationId);
      if (!o) map.set(f.integrationId, (o = { id: f.integrationId, name: f.integrationName, type: f.integrationType, files: [], size: 0 }));
      o.files.push(f);
      o.size += f.size;
    }
    return [...map.values()];
  }, [files]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(origins.length === 1 ? [origins[0].id] : []));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Copies of the same file share name and size: a file is lost only when every copy goes.
  const targets = files.filter((f) => selected.has(f.integrationId));
  const copies = new Map<string, LibraryFile[]>();
  for (const f of files) copies.set(`${f.name}|${f.size}`, [...(copies.get(`${f.name}|${f.size}`) ?? []), f]);
  const lost = [...copies.values()].filter((list) => list.every((f) => selected.has(f.integrationId)));
  const keptIn = origins.filter((o) => !selected.has(o.id) && o.files.some((f) => targets.some((x) => x.name === f.name && x.size === f.size)));

  const list = (names: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
  const where = list(origins.filter((o) => selected.has(o.id)).map((o) => o.name));
  const permanent = origins.some((o) => selected.has(o.id) && o.type !== "gdrive");
  const toTrash = origins.some((o) => selected.has(o.id) && o.type === "gdrive");

  const remove = useMutation({
    mutationFn: async () => {
      const failures: string[] = [];
      for (const f of targets) {
        try {
          await api(`/files/${f.id}?remote=1`, { method: "DELETE" });
        } catch (err) {
          failures.push(`${f.name}: ${err instanceof Error ? err.message : err}`);
        }
      }
      return { failures, total: targets.length };
    },
    onSuccess: ({ failures, total }) => {
      const ok = total - failures.length;
      if (ok) toast(t("library.remove.deleted", { count: ok, where }));
      for (const f of failures) toast(f, "error");
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["tags"] });
      onDone();
    },
  });

  return (
    <div className={cx("flex flex-col", compact ? "gap-3" : "gap-5")}>
      {origins.length > 1 && <p className="text-[13px] text-mute">{t("library.remove.choose")}</p>}

      <div role="group" aria-label={t("library.remove.originsLabel")} className="grid gap-2">
        {origins.map((o) => {
          const on = selected.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={origins.length === 1}
              onClick={() => toggle(o.id)}
              className={cx(
                "group relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow] duration-150 disabled:cursor-default",
                on
                  ? "border-danger/70 bg-danger-soft/50 shadow-[0_0_0_3px_var(--danger-soft)]"
                  : "border-line bg-panel hover:border-faint",
              )}
            >
              <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl transition-colors", on ? "bg-raised" : "bg-raised/70")}>
                <ProviderIcon type={o.type} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{o.name}</span>
                <span className="data mt-0.5 block truncate text-[11px] text-mute">
                  {t("library.remove.originMeta", { count: o.files.length, size: bytes(o.size) })}
                </span>
              </span>
              <span
                aria-hidden
                className={cx(
                  "grid size-6 shrink-0 place-items-center rounded-lg border transition-colors",
                  on ? "border-danger bg-danger text-white" : "border-line text-transparent group-hover:border-faint",
                )}
              >
                <Trash2 className="size-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[2.5rem]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {targets.length === 0 ? (
            <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[13px] text-faint">
              {t("library.remove.pickOne")}
            </motion.p>
          ) : (
            <motion.div key={[...selected].join()} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              <p className="text-[13px] text-ink">
                {t("library.remove.summary", { count: targets.length, size: bytes(targets.reduce((s, f) => s + f.size, 0)), where })}
              </p>
              {lost.length > 0 ? (
                <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[12.5px] leading-snug text-danger">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {t("library.remove.lost", { count: lost.length })}
                </p>
              ) : (
                keptIn.length > 0 && <p className="text-[12.5px] text-ok">{t("library.remove.stays", { where: list(keptIn.map((o) => o.name)) })}</p>
              )}
              <p className="data text-[10.5px] leading-relaxed text-mute">
                {toTrash && permanent
                  ? t("library.remove.noteMixed")
                  : toTrash
                    ? t("library.remove.noteTrash")
                    : t("library.remove.notePermanent")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={cx("flex justify-end gap-2", !compact && "border-t border-line pt-5")}>
        <Button size={compact ? "sm" : "md"} variant="ghost" onClick={onCancel} disabled={remove.isPending}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          size={compact ? "sm" : "md"}
          variant="danger"
          disabled={!targets.length}
          loading={remove.isPending}
          onClick={() => remove.mutate()}
          icon={<Trash2 className="size-3.5" />}
        >
          {targets.length ? t("library.remove.button", { count: targets.length }) : t("library.remove.buttonIdle")}
        </Button>
      </div>
    </div>
  );
}
