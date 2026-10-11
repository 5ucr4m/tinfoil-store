import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, ChevronLeft, ChevronRight, Copy, CopyPlus, Download, Eye, FolderInput, Play, ScanSearch, Tags, Plug, RefreshCw, Search, Trash2, Upload, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { Cartridge, LabelArt } from "../components/Cartridge";
import { useContextMenu, type MenuItem } from "../components/ContextMenu";
import { ProviderIcon as Provider } from "../components/ProviderIcon";
import { MoveTargets, TransferProgress, useDestinations, useMove, useTransfers } from "../components/Transfers";
import { ManageCollections, TitleCollections, TypeFilter, useTags, type TypeKey } from "../components/Collections";
import { ProviderIcon } from "../components/ProviderIcon";
import { Badge, Button, cx, Input, Modal, PageHeader, Select, Sheet, useToast } from "../components/ui";
import { Trans, useI18n } from "../i18n";
import { api, type Integration, type Kind, type LibraryFile, type PendingFile, type TagsResponse } from "../lib/api";
import { bytes, cleanName, genreLabel, kindLabel, prettyTitle, versionLabel } from "../lib/format";

interface Group {
  key: string;
  baseId: string | null;
  title: string;
  publisher: string | null;
  art: string | null;
  banner: string | null;
  files: LibraryFile[];
  size: number;
  latest: number;
  kinds: Set<Kind>;
  genres: Set<string>;
  /** Unique files; copies of the same file on other providers are its replicas. */
  items: Item[];
}

interface Item {
  key: string;
  name: string;
  size: number;
  kind: Kind;
  version: number | null;
  titleName: string | null;
  replicas: LibraryFile[];
}

const itemKey = (f: { name: string; size: number }) => `${f.name}|${f.size}`;

// titledb uses several names for the same eShop genre; groups keep one canonical name.
const GENRE_SYNONYMS: Record<string, string> = { Practical: "Utility", "Role-Playing": "RPG" };

function groupFiles(files: LibraryFile[]): Group[] {
  const map = new Map<string, Group>();
  for (const f of files) {
    const key = f.baseId ?? `file:${f.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        baseId: f.baseId,
        title: "",
        publisher: f.publisher,
        art: f.iconUrl,
        banner: f.bannerUrl,
        files: [],
        size: 0,
        latest: 0,
        kinds: new Set(),
        genres: new Set(),
        items: [],
      };
      map.set(key, g);
    }
    g.files.push(f);
    const existing = g.items.find((it) => it.key === itemKey(f));
    if (existing) existing.replicas.push(f);
    else {
      g.items.push({ key: itemKey(f), name: f.name, size: f.size, kind: f.kind, version: f.version, titleName: f.titleName, replicas: [f] });
      g.size += f.size;
    }
    g.latest = Math.max(g.latest, f.createdAt);
    g.kinds.add(f.kind);
    // Canonical titledb names: labels are translated at render time, so a language switch relabels instantly.
    for (const c of f.categories ?? []) g.genres.add(GENRE_SYNONYMS[c] ?? c);
  }
  for (const g of map.values()) {
    const base = g.files.find((f) => f.kind === "base") ?? g.files[0];
    g.title = base.baseName ? prettyTitle(base.baseName) : cleanName(base.name);
  }
  return [...map.values()];
}

const FILTERS: ("all" | Kind)[] = ["all", "base", "update", "dlc", "unknown"];

export function LibraryPage() {
  const { t, locale } = useI18n();
  const files = useQuery({ queryKey: ["files"], queryFn: () => api<{ files: LibraryFile[] }>("/files") });
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<{ integrations: Integration[] }>("/integrations"),
  });
  const titledb = useQuery({
    queryKey: ["titledb"],
    queryFn: () => api<{ state: string; count?: number }>("/titles/status"),
    refetchInterval: (q) => (q.state.data?.state === "running" ? 3000 : false),
  });

  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [provider, setProvider] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "size">("recent");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const pending = useQuery({ queryKey: ["identify-pending"], queryFn: () => api<{ files: PendingFile[] }>("/identify/pending") });
  const unidentified = pending.data?.files.length ?? 0;
  useTransfers({ notify: true });
  const [types, setTypes] = useState<Set<TypeKey>>(new Set());
  const [managing, setManaging] = useState(false);
  const tags = useTags();
  const memberships = tags.data?.items ?? {};
  const openMenu = useContextMenu();
  const menus = useLibraryMenus();
  const [deleting, setDeleting] = useState<LibraryFile[] | null>(null);

  const groups = useMemo(() => groupFiles(files.data?.files ?? []), [files.data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => filter === "all" || g.kinds.has(filter))
      .filter((g) => provider === "all" || g.files.some((f) => f.integrationId === provider))
      // Types combine with OR: "Metroidvania or Sports" shows both.
      .filter(
        (g) =>
          types.size === 0 ||
          [...types].some((type) =>
            type.startsWith("tag:") ? memberships[g.key]?.some((m) => m.id === type.slice(4)) : g.genres.has(type.slice(6)),
          ),
      )
      .filter((g) => !q || g.title.toLowerCase().includes(q) || g.baseId?.toLowerCase().includes(q) || g.files.some((f) => f.name.toLowerCase().includes(q)))
      .sort((a, b) =>
        sort === "name" ? a.title.localeCompare(b.title, locale) : sort === "size" ? b.size - a.size : b.latest - a.latest,
      );
  }, [groups, filter, provider, query, sort, types, memberships, locale]);

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groups) for (const name of g.genres) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [groups]);

  const toggleType = (key: TypeKey) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const total = groups.reduce((s, g) => s + g.size, 0);
  const providers = integrations.data?.integrations ?? [];
  const open = groups.find((g) => g.key === openKey) ?? null;

  const isEmpty = files.isSuccess && groups.length === 0;

  return (
    <>
      <PageHeader
        title={t("library.title")}
        meta={
          files.isSuccess && !isEmpty ? (
            <span className="data text-[12px]">
              {t("library.meta.titles", { count: groups.length })} · {t("library.meta.files", { count: files.data.files.length })} ·{" "}
              {bytes(total)}
              {providers.length > 1 && ` · ${t("library.meta.destinations", { count: providers.length })}`}
            </span>
          ) : null
        }
        actions={
          !isEmpty && (
            <Link to="/upload">
              <Button variant="primary" icon={<Upload className="size-4" />}>
                {t("library.uploadFiles")}
              </Button>
            </Link>
          )
        }
      />

      {titledb.data?.state === "running" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-mute"
        >
          <RefreshCw className="size-4 animate-spin text-signal" />
          {t("library.titledbRunning")}
        </motion.div>
      )}

      {unidentified > 0 && (
        <Link
          to="/identify"
          className="group mb-6 flex items-center gap-3 rounded-2xl border border-pin/50 bg-pin-dim/60 px-4 py-3 text-sm transition-colors hover:border-pin"
        >
          <ScanSearch className="size-5 shrink-0 text-pin" />
          <span className="min-w-0 flex-1">
            <b>{t("library.unidentified.count", { count: unidentified })}</b>{" "}
            <span className="text-mute">{t("library.unidentified.body")}</span>
          </span>
          <span className="shrink-0 font-medium text-ink group-hover:underline">{t("library.unidentified.action")}</span>
        </Link>
      )}

      {isEmpty ? (
        <EmptyLibrary hasProviders={providers.length > 0} />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("library.search.placeholder")}
                className="pl-9"
                aria-label={t("library.search.label")}
              />
            </div>
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1" role="tablist" aria-label={t("library.filters.label")}>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cx(
                    "relative h-8 shrink-0 rounded-lg px-3 text-[13px] transition-colors",
                    filter === f ? "text-ink" : "text-mute hover:text-ink",
                  )}
                >
                  {filter === f && (
                    <motion.span layoutId="lib-filter" className="absolute inset-0 rounded-lg bg-raised shadow-card" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                  )}
                  <span className="relative">{t(`library.filters.${f}`)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 lg:ml-auto">
              {providers.length > 1 && (
                <Select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label={t("library.destination.label")}>
                  <option value="all">{t("library.destination.all")}</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
              <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={t("library.sort.label")}>
                <option value="recent">{t("library.sort.recent")}</option>
                <option value="name">{t("library.sort.name")}</option>
                <option value="size">{t("library.sort.size")}</option>
              </Select>
            </div>
          </div>

          <TypeFilter
            tags={tags.data?.tags ?? []}
            genres={genres}
            selected={types}
            onToggle={toggleType}
            onClear={() => setTypes(new Set())}
            onManage={() => setManaging(true)}
          />

          {files.isLoading ? (
            <Grid>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="relative aspect-[0.7] overflow-hidden rounded-xl bg-panel">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-raised/70 to-transparent" style={{ animation: "shimmer 1.4s infinite" }} />
                </div>
              ))}
            </Grid>
          ) : visible.length === 0 ? (
            <p className="py-20 text-center text-sm text-mute">{t("library.noMatches")}</p>
          ) : (
            <Grid>
                {visible.map((g, i) => {
                  const updates = g.files.filter((f) => f.kind === "update").length;
                  const dlcs = g.files.filter((f) => f.kind === "dlc").length;
                  const meta = [
                    bytes(g.size),
                    updates && t("library.card.updates", { count: updates }),
                    dlcs && t("library.card.dlcs", { count: dlcs }),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    // Entry-only animation: exit/layout on 100+ cards stalls the grid when filtering.
                    <motion.div
                      key={g.key}
                      onContextMenu={(e) =>
                        openMenu(e, menus.forGroup(g, { open: () => setOpenKey(g.key), remove: () => setDeleting(g.files) }))
                      }
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.02, 0.3), duration: 0.25 } }}
                    >
                      <Cartridge
                        title={g.title}
                        art={g.art}
                        seed={g.key}
                        meta={meta}
                        onClick={() => setOpenKey(g.key)}
                        badges={
                          <>
                            {!g.kinds.has("base") && (g.kinds.has("update") || g.kinds.has("dlc")) && <Badge tone="pin">{t("library.card.noBase")}</Badge>}
                            {g.items.every((it) => it.replicas.length > 1) && <Badge tone="ok">{t("library.card.backup")}</Badge>}
                          </>
                        }
                      />
                    </motion.div>
                  );
                })}
            </Grid>
          )}
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpenKey(null)} label={open?.title ?? t("library.details")}>
        {open && <TitleDetail group={open} />}
      </Sheet>
      <ManageCollections open={managing} onClose={() => setManaging(false)} />
      <ConfirmDelete files={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  // Fluid: as many columns as fit, each at least ~150px wide.
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(172px,1fr))]">
      {children}
    </div>
  );
}

function EmptyLibrary({ hasProviders }: { hasProviders: boolean }) {
  const { t } = useI18n();
  return (
    <div className="board relative overflow-hidden rounded-[28px] border border-line px-6 py-16 text-center sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--paper)_75%)]" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        {/* Empty cartridge slot */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mb-10 h-36 w-28 rounded-[12px] border-2 border-dashed border-faint/70 p-2 pt-6"
          style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}
        >
          <div className="size-full rounded-md bg-panel" />
        </motion.div>
        <h2 className="display-narrow text-3xl">{t("library.empty.title")}</h2>
        <p className="mt-3 text-mute">{hasProviders ? t("library.empty.withProviders") : t("library.empty.noProviders")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {hasProviders ? (
            <Link to="/upload">
              <Button variant="primary" icon={<Upload className="size-4" />}>
                {t("library.uploadFiles")}
              </Button>
            </Link>
          ) : (
            <Link to="/integrations">
              <Button variant="primary" icon={<Plug className="size-4" />}>
                {t("library.empty.connect")}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const ORDER: Kind[] = ["base", "update", "dlc", "unknown"];

function TitleDetail({ group }: { group: Group }) {
  const { t } = useI18n();
  const banner = group.banner ?? group.art;
  return (
    <div>
      <div className="relative aspect-[16/8] overflow-hidden bg-shell">
        {banner ? (
          <img src={banner} alt="" className="size-full object-cover" />
        ) : (
          <LabelArt name="" seed={group.key} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/20 to-transparent" />
      </div>
      <div className="relative -mt-16 px-6 pb-10">
        <div className="flex items-end gap-4">
          <div className="size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-panel bg-shell shadow-xl">
            <LabelArt src={group.art} name={group.title} seed={group.key} />
          </div>
          <div className="min-w-0 pb-1">
            {group.baseId && <p className="data text-[11px] text-mute">{group.baseId}</p>}
            {group.publisher && <p className="truncate text-sm text-mute">{group.publisher}</p>}
          </div>
        </div>
        <h2 className="display mt-5 text-[clamp(1.6rem,4vw,2.2rem)]">{group.title}</h2>
        <p className="data mt-2 text-[12px] text-mute">
          {t("library.detail.files", { count: group.items.length })} · {bytes(group.size)}
          {group.items.some((it) => it.replicas.length > 1) &&
            ` · ${t("library.detail.backups", { count: group.items.filter((it) => it.replicas.length > 1).length })}`}
        </p>

        <TitleInfoBlock group={group} />

        <div className="mt-8 flex flex-col gap-7">
          <TitleCollections itemKey={group.key} />
          <MoveAll group={group} />
          {ORDER.filter((k) => group.items.some((it) => it.kind === k)).map((kind) => (
            <div key={kind}>
              <h3 className="eyebrow mb-3">{t(`library.sections.${kind}`)}</h3>
              <ul className="flex flex-col gap-2">
                {group.items
                  .filter((it) => it.kind === kind)
                  .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
                  .map((it) => (
                    <FileRow key={it.key} item={it} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Copies the whole title to another provider (backup) or moves it there. */
function MoveAll({ group }: { group: Group }) {
  const { t } = useI18n();
  const move = useMove();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"copy" | "move">("copy");
  // A destination that already holds every file is not a target.
  const complete = (destId: string) => group.items.every((it) => it.replicas.some((r) => r.integrationId === destId));
  const holding = [...new Set(group.files.map((f) => f.integrationId))].filter(complete);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="eyebrow inline-flex items-center gap-2 hover:text-ink">
        <ArrowRightLeft className="size-3.5" /> {t("library.detail.copyOrMove", { count: group.items.length })}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-3">
              <ModeSwitch mode={mode} setMode={setMode} />
              <MoveTargets
                exclude={holding}
                disabled={move.isPending}
                onPick={(dest) => {
                  let n = 0;
                  for (const it of group.items) {
                    if (it.replicas.some((r) => r.integrationId === dest.id)) continue;
                    move.mutate({ fileId: it.replicas[0].id, integrationId: dest.id, mode });
                    n++;
                  }
                  toast(t(mode === "copy" ? "library.transfer.copying" : "library.transfer.moving", { count: n, destination: dest.name }), "info");
                  setOpen(false);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeSwitch({ mode, setMode }: { mode: "copy" | "move"; setMode: (m: "copy" | "move") => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex w-fit rounded-lg border border-line bg-panel p-0.5 text-[12px]" role="radiogroup" aria-label={t("library.mode.label")}>
        {(["copy", "move"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cx("rounded-md px-2.5 py-1", mode === m ? "bg-raised font-medium shadow-card" : "text-mute")}
          >
            {t(m === "copy" ? "library.mode.copy" : "library.mode.move")}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-mute">
        {t(mode === "copy" ? "library.mode.copyHint" : "library.mode.moveHint")}
      </p>
    </div>
  );
}

function FileRow({ item }: { item: Item }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const transfers = useTransfers();
  const move = useMove();
  const openMenu = useContextMenu();
  const menus = useLibraryMenus();
  const ids = new Set(item.replicas.map((r) => r.id));
  const transfer = transfers.find((tr) => ids.has(tr.fileId) && tr.state !== "done" && tr.state !== "error");
  const [panel, setPanel] = useState<"delete" | "move" | null>(null);
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const primary = item.replicas[0];
  const replicated = item.replicas.length > 1;

  const remove = useMutation({
    mutationFn: async (files: LibraryFile[]) => {
      for (const f of files) await api(`/files/${f.id}?remote=1`, { method: "DELETE" });
      return files;
    },
    onSuccess: (files) => {
      toast(files.length > 1 ? t("library.row.allCopiesDeleted") : t("library.row.copyDeleted", { name: files[0].integrationName }));
      setPanel(null);
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(err.message, "error"),
  });

  return (
    <motion.li
      layout
      onContextMenu={(e) =>
        openMenu(e, menus.forItem(item, { remove: () => setPanel("delete"), removeCopy: (f) => remove.mutate([f]), busy: !!transfer }))
      }
      className="rounded-2xl border border-line bg-raised p-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.name}>
            {item.kind === "dlc" && item.titleName ? prettyTitle(item.titleName) : item.name}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-mute">
            <span className="data text-[11px]">{bytes(item.size)}</span>
            {versionLabel(item.version) && <span className="data text-[11px]">{versionLabel(item.version)}</span>}
            {item.replicas.map((r) => (
              <span
                key={r.id}
                className={cx(
                  "inline-flex items-center gap-1.5 text-[12px]",
                  replicated && "rounded-full border border-line bg-panel px-2 py-0.5",
                )}
              >
                <ProviderIcon type={r.integrationType} className="size-3.5" />
                {r.integrationName}
              </span>
            ))}
            {replicated && <Badge tone="ok">{t("library.card.backup")}</Badge>}
            {item.kind === "unknown" && <Badge tone="pin">{kindLabel("unknown")}</Badge>}
          </div>
        </div>
        <button
          onClick={() => setPanel((p) => (p === "move" ? null : "move"))}
          disabled={!!transfer}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-signal-soft hover:text-signal disabled:opacity-40"
          aria-label={t("library.row.copyOrMoveFile", { name: item.name })}
          aria-expanded={panel === "move"}
          title={t("library.row.copyOrMove")}
        >
          <ArrowRightLeft className="size-4" />
        </button>
        <a
          href={`/api/files/${primary.id}/download`}
          download={item.name}
          onClick={() => toast(t("library.row.downloading", { name: item.name }), "info")}
          className="-ml-2 grid size-8 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-signal-soft hover:text-signal"
          aria-label={t("library.row.downloadFile", { name: item.name })}
          title={t("common.actions.download")}
        >
          <Download className="size-4" />
        </a>
        <button
          onClick={() => setPanel((p) => (p === "delete" ? null : "delete"))}
          disabled={!!transfer}
          className="-ml-2 grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-40"
          aria-label={t("library.row.deleteFile", { name: item.name })}
          aria-expanded={panel === "delete"}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {transfer && <TransferProgress transfer={transfer} className="mt-3 border-t border-line pt-3" />}
      <AnimatePresence initial={false}>
        {panel === "move" && !transfer && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
              {replicated ? (
                <p className="text-[13px] text-mute">{t("library.row.createCopyIn")}</p>
              ) : (
                <ModeSwitch mode={mode} setMode={setMode} />
              )}
              <MoveTargets
                exclude={item.replicas.map((r) => r.integrationId)}
                disabled={move.isPending}
                onPick={(dest) => {
                  move.mutate({ fileId: primary.id, integrationId: dest.id, mode: replicated ? "copy" : mode });
                  setPanel(null);
                }}
              />
            </div>
          </motion.div>
        )}
        {panel === "delete" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              {replicated ? (
                <>
                  <p className="text-[13px] text-mute">{t("library.row.deleteOneHint")}</p>
                  {item.replicas.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-[13px]">
                      <ProviderIcon type={r.integrationType} className="size-3.5" />
                      <span className="flex-1">{r.integrationName}</span>
                      <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate([r])}>
                        {t("library.row.deleteThisCopy")}
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>
                      {t("common.actions.cancel")}
                    </Button>
                    <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate(item.replicas)}>
                      {t("library.row.deleteAllCopies")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-[13px] text-mute">
                    {t(
                      primary.integrationType === "gdrive"
                        ? "library.row.trashDrive"
                        : primary.integrationType === "s3"
                          ? "library.row.deleteBucket"
                          : "library.row.deleteDisk",
                    )}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setPanel(null)} disabled={remove.isPending}>
                    {t("common.actions.cancel")}
                  </Button>
                  <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate([primary])}>
                    {t("library.row.deleteButton")}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

interface TitleDetails {
  name: string | null;
  description: string | null;
  categories: string[];
  screenshots: string[];
  releaseDate: string | null;
  developer: string | null;
  players: number | null;
}

/** Genres, gameplay screenshots, YouTube shortcut and description from titledb. */
function TitleInfoBlock({ group }: { group: Group }) {
  const { t } = useI18n();
  const details = useQuery({
    queryKey: ["title-details", group.baseId],
    queryFn: () => api<TitleDetails>(`/titles/${group.baseId}/details`),
    enabled: !!group.baseId,
    staleTime: Infinity,
  });
  const [expanded, setExpanded] = useState(false);
  const [shot, setShot] = useState<number | null>(null);
  const d = details.data;
  const youtubeQuery = `${group.title} nintendo switch gameplay`;
  const youtube = youtubeUrl(group.title);
  const year = d?.releaseDate?.slice(0, 4);

  return (
    <div className="mt-5 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {[...group.genres].map((g) => (
          <span key={g} className="rounded-full border border-line bg-raised px-2.5 py-1 text-[12px]">
            {genreLabel(g)}
          </span>
        ))}
        {d?.players ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1 text-[12px] text-mute">
            <Users className="size-3" /> {t("library.info.players", { count: d.players })}
          </span>
        ) : null}
        {year && <span className="data text-[11px] text-mute">{year}</span>}
        {d?.developer && <span className="text-[12px] text-mute">· {d.developer}</span>}
      </div>

      <a
        href={youtube}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-3 rounded-2xl border border-line bg-raised p-3 transition-colors hover:border-[#ff0033]"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-[#ff0033] text-white transition-transform group-hover:scale-105">
          <Play className="size-4 fill-current" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{t("library.info.youtube")}</span>
          <span className="block truncate text-[12px] text-mute">{t("library.info.youtubeHint", { query: youtubeQuery })}</span>
        </span>
      </a>

      {d && d.screenshots.length > 0 && (
        <div>
          <h3 className="eyebrow mb-3">{t("library.info.images")}</h3>
          <div className="no-scrollbar -mx-6 flex snap-x gap-2.5 overflow-x-auto px-6 pb-1">
            {d.screenshots.map((src, i) => (
              <button
                key={src}
                onClick={() => setShot(i)}
                className="aspect-video w-56 shrink-0 snap-start overflow-hidden rounded-xl bg-shell ring-1 ring-line transition-transform hover:scale-[1.02]"
                aria-label={t("library.info.openImage", { number: i + 1 })}
              >
                <img src={src} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {d?.description && (
        <div>
          <h3 className="eyebrow mb-2">{t("library.info.about")}</h3>
          <p className={cx("text-sm leading-relaxed whitespace-pre-line text-ink/85", !expanded && "line-clamp-4")}>
            {d.description}
          </p>
          {d.description.length > 280 && (
            <button onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-[13px] text-signal hover:underline">
              {expanded ? t("library.info.showLess") : t("library.info.readMore")}
            </button>
          )}
        </div>
      )}

      {d && shot !== null && <Lightbox images={d.screenshots} index={shot} onChange={setShot} />}
    </div>
  );
}

function Lightbox({ images, index, onChange }: { images: string[]; index: number; onChange: (i: number | null) => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onChange(null);
      }
      if (e.key === "ArrowRight") onChange((index + 1) % images.length);
      if (e.key === "ArrowLeft") onChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, images.length, onChange]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={() => onChange(null)}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={images[index]}
          src={images[index]}
          alt=""
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="max-h-[85dvh] max-w-full rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </AnimatePresence>
      <button onClick={() => onChange(null)} aria-label={t("common.actions.close")} className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <X className="size-5" />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange((index - 1 + images.length) % images.length);
            }}
            aria-label={t("library.lightbox.previous")}
            className="absolute left-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange((index + 1) % images.length);
            }}
            aria-label={t("library.lightbox.next")}
            className="absolute right-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="size-5" />
          </button>
          <p className="data absolute bottom-5 text-[11px] text-white/60">
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </motion.div>,
    document.body,
  );
}

const startDownload = (file: LibraryFile) => {
  const a = document.createElement("a");
  a.href = `/api/files/${file.id}/download`;
  a.download = file.name;
  a.click();
};

const youtubeUrl = (title: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} nintendo switch gameplay`)}`;

/** Right-click menus for cartridges and file rows. */
function useLibraryMenus() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const move = useMove();
  const destinations = useDestinations().data?.integrations ?? [];
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => api<TagsResponse>("/tags") }).data;
  const ready = destinations.filter((d) => d.status !== "pending");

  /** Targets for a set of items: destinations that don't already hold all of them. */
  const transferItems = (items: Item[], mode: "copy" | "move"): MenuItem[] => {
    const options = ready.filter((d) => !items.every((it) => it.replicas.some((r) => r.integrationId === d.id)));
    if (!options.length) return [{ label: t("library.menu.noDestination"), disabled: true }];
    return options.map((d) => ({
      label: d.name,
      icon: <Provider type={d.type} />,
      onSelect: () => {
        const todo = items.filter((it) => !it.replicas.some((r) => r.integrationId === d.id));
        for (const it of todo) move.mutate({ fileId: it.replicas[0].id, integrationId: d.id, mode });
        toast(t(mode === "copy" ? "library.transfer.copying" : "library.transfer.moving", { count: todo.length, destination: d.name }), "info");
      },
    }));
  };

  const toggleTag = async (tagId: string, key: string, member: { auto: boolean } | undefined) => {
    const state = member ? (member.auto ? "remove" : "auto") : "add";
    const data = await api<TagsResponse>(`/tags/${tagId}/items`, { method: "PUT", json: { key, state } });
    qc.setQueryData(["tags"], data);
  };

  const forGroup = (g: Group, actions: { open: () => void; remove: () => void }): MenuItem[] => {
    const members = new Map((tags?.items[g.key] ?? []).map((m) => [m.id, m]));
    const sorted = [...g.items].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (b.version ?? 0) - (a.version ?? 0));
    const anyReplicated = g.items.some((it) => it.replicas.length > 1);
    return [
      { label: t("library.menu.open"), icon: <Eye />, onSelect: actions.open },
      sorted.length === 1
        ? { label: t("common.actions.download"), icon: <Download />, hint: bytes(sorted[0].size), onSelect: () => startDownload(sorted[0].replicas[0]) }
        : {
            label: t("common.actions.download"),
            icon: <Download />,
            submenu: sorted.map((it) => ({
              label:
                it.kind === "update" && it.version
                  ? t("library.menu.updateVersion", { version: it.version })
                  : t(`library.menu.fileLabel.${it.kind}`),
              hint: bytes(it.size),
              onSelect: () => startDownload(it.replicas[0]),
            })),
          },
      { label: t("library.info.youtube"), icon: <Play />, onSelect: () => window.open(youtubeUrl(g.title), "_blank", "noopener") },
      { separator: true },
      { label: t("library.menu.copyTo"), icon: <CopyPlus />, submenu: transferItems(g.items, "copy") },
      { label: g.items.length > 1 ? t("library.menu.moveAllTo") : t("library.menu.moveTo"), icon: <FolderInput />, submenu: transferItems(g.items, "move"), disabled: anyReplicated },
      {
        label: t("library.menu.collections"),
        icon: <Tags />,
        submenu: (tags?.tags ?? []).map((tag) => ({
          label: tag.name,
          checked: members.has(tag.id),
          hint: members.get(tag.id)?.auto ? t("library.menu.auto") : undefined,
          onSelect: () => void toggleTag(tag.id, g.key, members.get(tag.id)),
        })),
      },
      { separator: true },
      {
        label: t("library.menu.deleteFiles", { count: g.files.length }),
        icon: <Trash2 />,
        danger: true,
        onSelect: actions.remove,
      },
    ];
  };

  const forItem = (
    item: Item,
    actions: { remove: () => void; removeCopy: (f: LibraryFile) => void; busy: boolean },
  ): MenuItem[] => {
    const replicated = item.replicas.length > 1;
    return [
      { label: t("common.actions.download"), icon: <Download />, hint: bytes(item.size), onSelect: () => startDownload(item.replicas[0]) },
      { label: t("library.menu.copyTo"), icon: <CopyPlus />, submenu: transferItems([item], "copy"), disabled: actions.busy },
      { label: t("library.menu.moveTo"), icon: <FolderInput />, submenu: transferItems([item], "move"), disabled: actions.busy || replicated },
      ...(replicated
        ? [
            {
              label: t("library.menu.deleteCopyFrom"),
              icon: <Trash2 />,
              submenu: item.replicas.map((r) => ({
                label: r.integrationName,
                icon: <Provider type={r.integrationType} />,
                onSelect: () => actions.removeCopy(r),
              })),
            } as MenuItem,
          ]
        : []),
      {
        label: t("library.menu.copyName"),
        icon: <Copy />,
        onSelect: () => void navigator.clipboard.writeText(item.name).then(() => toast(t("library.menu.nameCopied"))),
      },
      { separator: true },
      {
        label: replicated ? t("library.menu.deleteAllCopies") : t("library.menu.deleteFiles", { count: 1 }),
        icon: <Trash2 />,
        danger: true,
        onSelect: actions.remove,
        disabled: actions.busy,
      },
    ];
  };

  return { forGroup, forItem };
}

function ConfirmDelete({ files, onClose }: { files: LibraryFile[] | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: async (list: LibraryFile[]) => {
      const failures: string[] = [];
      for (const f of list) {
        try {
          await api(`/files/${f.id}?remote=1`, { method: "DELETE" });
        } catch (err) {
          failures.push(`${f.name}: ${err instanceof Error ? err.message : err}`);
        }
      }
      return { failures, total: list.length };
    },
    onSuccess: ({ failures, total }) => {
      const ok = total - failures.length;
      if (ok) toast(t("library.confirm.deleted", { count: ok }));
      for (const f of failures) toast(f, "error");
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      onClose();
    },
  });
  const list = files ?? [];
  return (
    <Modal open={!!files} onClose={onClose} title={t("library.confirm.title", { count: list.length })}>
      <p className="text-sm text-mute">{t("library.confirm.body")}</p>
      <ul className="mt-4 flex flex-col gap-1.5 rounded-xl border border-line bg-panel p-3">
        {list.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-[12px]">
            <Provider type={f.integrationType} className="size-3.5 shrink-0" />
            <span className="data min-w-0 flex-1 truncate" title={f.name}>
              {f.name}
            </span>
            <span className="data shrink-0 text-mute">{bytes(f.size)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={remove.isPending}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(list)}>
          {t("library.confirm.button", { count: list.length })}
        </Button>
      </div>
    </Modal>
  );
}
