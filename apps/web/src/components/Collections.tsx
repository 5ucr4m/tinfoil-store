import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { api, type Tag, type TagsResponse } from "../lib/api";
import { genreLabel } from "../lib/format";
import { Button, cx, Field, Input, Modal, useToast } from "./ui";

export const tagColor = (hue: number) => `oklch(0.68 0.16 ${hue})`;

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => api<TagsResponse>("/tags") });
}

const GENRES_COLLAPSED = 10;

export type TypeKey = `tag:${string}` | `genre:${string}`;

/** Filter chips: user collections first, then eShop genres present in the library. */
export function TypeFilter({
  tags,
  genres,
  selected,
  onToggle,
  onClear,
  onManage,
  canManage,
}: {
  tags: Tag[];
  genres: { name: string; count: number }[];
  selected: Set<TypeKey>;
  onToggle: (key: TypeKey) => void;
  onClear: () => void;
  onManage: () => void;
  /** Read-only accounts filter by collections but don't edit them. */
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  // Keep the row short: the most common genres, plus any selected one hidden by the cut.
  const visibleGenres = showAll
    ? genres
    : genres.filter((g, i) => i < GENRES_COLLAPSED || selected.has(`genre:${g.name}`));
  const hidden = genres.length - visibleGenres.length;
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-1">{t("collections.filter.label")}</span>
      {tags.map((tag) => (
        <Chip key={tag.id} active={selected.has(`tag:${tag.id}`)} onClick={() => onToggle(`tag:${tag.id}`)} hue={tag.hue} count={tag.count}>
          {tag.name}
        </Chip>
      ))}
      {canManage && (
        <button
          onClick={onManage}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line px-3 text-[12px] text-mute transition-colors hover:border-signal hover:text-signal"
        >
          <Settings2 className="size-3.5" />
          {t("collections.filter.manage")}
        </button>
      )}
      {genres.length > 0 && <span className="mx-1 h-5 w-px bg-line" aria-hidden />}
      {visibleGenres.map((g) => (
        <Chip key={g.name} active={selected.has(`genre:${g.name}`)} onClick={() => onToggle(`genre:${g.name}`)} count={g.count}>
          {genreLabel(g.name)}
        </Chip>
      ))}
      {(hidden > 0 || showAll) && genres.length > GENRES_COLLAPSED && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex h-8 items-center rounded-full px-2.5 text-[12px] text-signal hover:underline"
        >
          {showAll ? t("collections.filter.fewer") : t("collections.filter.moreGenres", { count: hidden })}
        </button>
      )}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onClear}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] text-mute hover:text-ink"
          >
            <X className="size-3.5" /> {t("common.actions.clear")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({
  active,
  onClick,
  hue,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hue?: number;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition-[background-color,border-color,color] duration-150",
        active ? "border-signal bg-signal text-signal-ink" : "border-line bg-raised text-ink hover:border-faint",
      )}
    >
      {hue !== undefined && (
        <span
          className={cx("size-2 rounded-full", active && "ring-2 ring-white/70")}
          style={{ background: tagColor(hue) }}
        />
      )}
      {children}
      <span className={cx("data text-[10px]", active ? "opacity-80" : "text-mute")}>{count}</span>
    </button>
  );
}

/** Collection toggles inside the title sheet. */
export function TitleCollections({ itemKey }: { itemKey: string }) {
  const { t: tr } = useI18n();
  const qc = useQueryClient();
  const tags = useTags();
  const [managing, setManaging] = useState(false);
  const set = useMutation({
    mutationFn: ({ id, state }: { id: string; state: "add" | "remove" | "auto" }) =>
      api<TagsResponse>(`/tags/${id}/items`, { method: "PUT", json: { key: itemKey, state } }),
    onSuccess: (data) => qc.setQueryData(["tags"], data),
  });
  const membership = new Map((tags.data?.items[itemKey] ?? []).map((m) => [m.id, m]));

  return (
    <div>
      <h3 className="eyebrow mb-3">{tr("collections.title")}</h3>
      <div className="flex flex-wrap gap-2">
        {(tags.data?.tags ?? []).map((t) => {
          const m = membership.get(t.id);
          return (
            <button
              key={t.id}
              aria-pressed={!!m}
              title={m?.auto ? tr("collections.matchedBy", { keywords: t.keywords.join(", ") }) : undefined}
              onClick={() => set.mutate({ id: t.id, state: m ? (m.auto ? "remove" : "auto") : "add" })}
              className={cx(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors",
                m ? "border-transparent text-white" : "border-dashed border-line text-mute hover:border-faint hover:text-ink",
              )}
              style={m ? { background: tagColor(t.hue) } : undefined}
            >
              {!m && <Plus className="size-3.5" />}
              {t.name}
              {m?.auto && <span className="data rounded bg-black/20 px-1 text-[9px] uppercase">{tr("collections.auto")}</span>}
            </button>
          );
        })}
        <button
          onClick={() => setManaging(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[12px] text-mute hover:text-signal"
        >
          <Settings2 className="size-3.5" /> {tr("collections.manage")}
        </button>
      </div>
      <ManageCollections open={managing} onClose={() => setManaging(false)} />
    </div>
  );
}

const HUES = [285, 25, 355, 160, 210, 60, 120, 320] as const;

export function ManageCollections({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t: tr } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const tags = useTags();
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");

  const onData = (data: TagsResponse) => qc.setQueryData(["tags"], data);
  const create = useMutation({
    mutationFn: () => api<TagsResponse>("/tags", { method: "POST", json: { name, keywords: splitKeywords(keywords) } }),
    onSuccess: (data) => {
      onData(data);
      toast(tr("collections.modal.created", { name }));
      setName("");
      setKeywords("");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; hue?: number; keywords?: string[] }) =>
      api<TagsResponse>(`/tags/${id}`, { method: "PATCH", json: body }),
    onSuccess: onData,
    onError: (e) => toast(e.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<TagsResponse>(`/tags/${id}`, { method: "DELETE" }),
    onSuccess: onData,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title={tr("collections.title")} wide>
      <p className="mb-5 text-sm text-mute">{tr("collections.modal.intro")}</p>

      <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Field label={tr("collections.modal.newLabel")}>
          {(id) => (
            <Input id={id} placeholder={tr("collections.modal.newPlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label={tr("collections.modal.keywordsLabel")}>
          {(id) => (
            <Input
              id={id}
              placeholder={tr("collections.modal.keywordsPlaceholder")}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" icon={<Plus className="size-4" />} loading={create.isPending} disabled={!name.trim()}>
          {tr("collections.modal.create")}
        </Button>
      </form>

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {(tags.data?.tags ?? []).map((t) => (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl border border-line bg-raised p-4"
            >
              <div className="flex items-center gap-3">
                <input
                  defaultValue={t.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && update.mutate({ id: t.id, name: e.target.value })}
                  className="display-narrow min-w-0 flex-1 rounded-md bg-transparent text-lg focus:outline-none"
                  aria-label={tr("collections.modal.nameLabel")}
                />
                <span className="data text-[11px] text-mute">{tr("collections.modal.games", { count: t.count })}</span>
                <button
                  onClick={() => remove.mutate(t.id)}
                  aria-label={tr("collections.modal.delete", { name: t.name })}
                  className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={tr("collections.modal.color")}>
                {HUES.map((h) => (
                  <button
                    key={h}
                    role="radio"
                    aria-checked={t.hue === h}
                    aria-label={tr(`collections.colors.${h}` as const)}
                    onClick={() => update.mutate({ id: t.id, hue: h })}
                    className={cx("size-5 rounded-full transition-transform hover:scale-110", t.hue === h && "ring-2 ring-ink ring-offset-2 ring-offset-raised")}
                    style={{ background: tagColor(h) }}
                  />
                ))}
              </div>
              <Input
                key={t.keywords.join(",")}
                defaultValue={t.keywords.join(", ")}
                placeholder={tr("collections.modal.noKeywords")}
                onBlur={(e) => {
                  const next = splitKeywords(e.target.value);
                  if (next.join(",") !== t.keywords.join(",")) update.mutate({ id: t.id, keywords: next });
                }}
                className="data mt-3 text-[12px]"
                aria-label={tr("collections.modal.keywordsOf", { name: t.name })}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Modal>
  );
}

const splitKeywords = (v: string) =>
  v
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
