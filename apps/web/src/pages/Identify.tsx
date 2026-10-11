import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, FileSearch, RotateCcw, ScanSearch, Search, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { LabelArt } from "../components/Cartridge";
import { ProviderIcon } from "../components/ProviderIcon";
import { Badge, Button, cx, Input, PageHeader, Spinner, useToast } from "../components/ui";
import { Trans, useI18n } from "../i18n";
import { api, type Candidate, type Identification, type PendingFile } from "../lib/api";
import { bytes, prettyTitle } from "../lib/format";

interface Choice {
  titleId: string;
  /** Base title the choice came from, so the user can flip between game and update. */
  baseId: string;
  name: string;
  iconUrl: string | null;
  kind: "base" | "update" | "dlc" | "unknown";
  version: number | null;
}

const kindOf = (id: string): Choice["kind"] => {
  const low = id.slice(-3).toUpperCase();
  return low === "000" ? "base" : low === "800" ? "update" : "dlc";
};

function initialChoice(i: Identification | null): Choice | null {
  if (!i?.titleId) return null;
  const kind = kindOf(i.titleId);
  return {
    titleId: i.titleId,
    baseId: kind === "dlc" ? i.titleId : `${i.titleId.slice(0, 13)}000`,
    name: i.title?.name ?? i.candidates[0]?.name ?? i.titleId,
    iconUrl: i.title?.iconUrl ?? i.candidates[0]?.iconUrl ?? null,
    kind,
    version: i.version,
  };
}

const CONFIDENCE_TONE = { high: "ok", medium: "pin", low: "danger" } as const;

interface Done {
  fileId: string;
  oldName: string;
  newName: string;
  renameId: string;
  undone?: boolean;
}

export function IdentifyPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const pending = useQuery({ queryKey: ["identify-pending"], queryFn: () => api<{ files: PendingFile[] }>("/identify/pending") });
  const [choices, setChoices] = useState<Record<string, Choice | null>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Done[]>([]);

  const run = useMutation({
    mutationFn: () => api<{ files: PendingFile[] }>("/identify/run", { method: "POST", json: {} }),
    onSuccess: (data) => qc.setQueryData(["identify-pending"], data),
    onError: (e) => toast(e.message, "error"),
  });

  const files = pending.data?.files ?? [];

  // Seed choices and preselect what is safe to rename without looking.
  useEffect(() => {
    setChoices((prev) => {
      const next = { ...prev };
      for (const f of files) if (!(f.id in next) || next[f.id] === null) next[f.id] = initialChoice(f.identification);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of files) {
        const i = f.identification;
        if (i?.titleId && i.confidence === "high" && !i.needsVersion) next.add(f.id);
      }
      return next;
    });
  }, [files]);

  // First visit: analyse automatically.
  const unanalysed = files.filter((f) => !f.identification).length;
  useEffect(() => {
    if (pending.isSuccess && unanalysed > 0 && !run.isPending && !run.isSuccess) run.mutate();
  }, [pending.isSuccess, unanalysed]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = (id: string) => {
    const c = choices[id];
    return !!c && !(c.kind === "update" && c.version == null);
  };
  const selectedReady = [...selected].filter((id) => files.some((f) => f.id === id) && ready(id));

  const apply = useMutation({
    mutationFn: () =>
      api<{ results: ({ fileId: string; ok: true; oldName: string; newName: string; renameId: string } | { fileId: string; ok: false; error: string })[] }>(
        "/identify/apply",
        {
          method: "POST",
          json: { items: selectedReady.map((id) => ({ fileId: id, titleId: choices[id]!.titleId, version: choices[id]!.version })) },
        },
      ),
    onSuccess: ({ results }) => {
      const ok = results.filter((r) => r.ok) as Done[];
      const failed = results.filter((r) => !r.ok) as { fileId: string; error: string }[];
      setDone((d) => [...ok, ...d]);
      setSelected(new Set());
      if (ok.length) toast(t("identify.renamed", { count: ok.length }));
      for (const f of failed) toast(f.error, "error");
      void qc.invalidateQueries({ queryKey: ["identify-pending"] });
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e) => toast(e.message, "error"),
  });

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const f of files) if (f.identification) c[f.identification.confidence]++;
    return c;
  }, [files]);

  return (
    <>
      <PageHeader
        title={t("identify.title")}
        meta={files.length ? t("identify.meta") : undefined}
        actions={
          files.length > 0 && (
            <Button icon={<RotateCcw className="size-4" />} loading={run.isPending} onClick={() => run.mutate()}>
              {t("identify.reanalyze")}
            </Button>
          )
        }
      />

      <DoneList done={done} setDone={setDone} />

      {pending.isLoading ? (
        <Spinner className="mx-auto mt-16 size-6" />
      ) : files.length === 0 ? (
        <div className="rounded-3xl border border-line bg-panel px-6 py-16 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-ok-soft text-ok">
            <Check className="size-7" strokeWidth={2.5} />
          </div>
          <h2 className="display-narrow mt-5 text-2xl">{t("identify.allDone.title")}</h2>
          <p className="mx-auto mt-2 max-w-md text-mute">{t("identify.allDone.body")}</p>
          <Link to="/" className="mt-6 inline-block">
            <Button>{t("identify.allDone.back")}</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="sticky top-14 z-20 -mx-2 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper/90 px-4 py-3 backdrop-blur md:top-3">
            {run.isPending ? (
              <span className="flex items-center gap-2 text-sm text-mute">
                <ScanSearch className="size-4 animate-pulse text-signal" /> {t("identify.analyzing")}
              </span>
            ) : (
              <span className="data flex flex-wrap gap-3 text-[12px] text-mute">
                <span><Trans k="identify.counts.high" params={{ count: counts.high }} components={{ b: <b className="text-ok" /> }} /></span>
                <span><Trans k="identify.counts.medium" params={{ count: counts.medium }} components={{ b: <b className="text-pin" /> }} /></span>
                <span><Trans k="identify.counts.low" params={{ count: counts.low }} components={{ b: <b className="text-danger" /> }} /></span>
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSelected(
                    selected.size ? new Set() : new Set(files.filter((f) => ready(f.id)).map((f) => f.id)),
                  )
                }
              >
                {selected.size ? t("identify.selection.clear") : t("identify.selection.selectReady")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedReady.length}
                loading={apply.isPending}
                onClick={() => apply.mutate()}
              >
                {t("identify.rename", { count: selectedReady.length || "" }).trim()}
              </Button>
            </div>
          </div>

          <ul className="flex flex-col gap-2.5">
            {files.map((f) => (
              <Row
                key={f.id}
                file={f}
                choice={choices[f.id] ?? null}
                setChoice={(c) => {
                  setChoices((prev) => ({ ...prev, [f.id]: c }));
                  if (c) setSelected((prev) => new Set(prev).add(f.id));
                }}
                selected={selected.has(f.id)}
                toggle={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(f.id)) next.delete(f.id);
                    else next.add(f.id);
                    return next;
                  })
                }
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Row({
  file,
  choice,
  setChoice,
  selected,
  toggle,
}: {
  file: PendingFile;
  choice: Choice | null;
  setChoice: (c: Choice | null) => void;
  selected: boolean;
  toggle: () => void;
}) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const ident = file.identification;
  const ext = file.name.match(/\.[^.]+$/)?.[0] ?? ".nsp";
  const preview = useQuery({
    queryKey: ["identify-name", choice?.titleId, choice?.version, ext],
    queryFn: () =>
      api<{ name: string }>(
        `/identify/name?titleId=${choice!.titleId}&ext=${ext}${choice!.version != null ? `&version=${choice!.version}` : ""}`,
      ),
    enabled: !!choice,
    staleTime: Infinity,
  });
  const needsVersion = choice?.kind === "update" && choice.version == null;
  const conf = ident ? { label: t(`identify.confidence.${ident.confidence}`), tone: CONFIDENCE_TONE[ident.confidence] } : null;

  return (
    <motion.li layout className={cx("rounded-2xl border bg-raised p-4 transition-colors", selected ? "border-signal/60" : "border-line")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={toggle}
          disabled={!choice}
          aria-label={t("identify.row.select", { name: file.name })}
          className="mt-1 size-4 shrink-0 accent-[var(--signal)]"
        />
        <div className="min-w-0 flex-1">
          {/* Current name */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="data min-w-0 truncate text-[12px] text-mute" title={file.name}>
              {file.name}
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] text-faint">
              <ProviderIcon type={file.integrationType} className="size-3" /> {file.integrationName} · {bytes(file.size)}
            </span>
          </div>

          {/* Suggestion */}
          <div className="mt-3 flex items-center gap-3">
            <ArrowRight className="size-4 shrink-0 text-faint" />
            {choice ? (
              <>
                <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-shell">
                  <LabelArt src={choice.iconUrl} name={choice.name} seed={choice.baseId} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{prettyTitle(choice.name)}</p>
                    {conf && ident?.titleId === choice.titleId && <Badge tone={conf.tone}>{conf.label}</Badge>}
                    {ident && ident.titleId === choice.titleId && <span className="text-[11px] text-mute">{t(`identify.source.${ident.source}`)}</span>}
                    {ident && ident.titleId !== choice.titleId && <Badge tone="signal">{t("identify.row.pickedByYou")}</Badge>}
                  </div>
                  <p className="data mt-1 truncate text-[11px] text-ink/70" title={preview.data?.name}>
                    {preview.data?.name ?? "…"}
                  </p>
                </div>
              </>
            ) : (
              <p className="flex-1 text-sm text-mute">
                {ident ? t("identify.row.noMatch") : t("identify.row.notAnalyzed")}
              </p>
            )}
            <Button size="sm" variant="ghost" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
              {choice ? t("identify.row.change") : t("identify.row.choose")} <ChevronDown className={cx("size-3.5 transition-transform", picking && "rotate-180")} />
            </Button>
          </div>

          {/* Game vs update, version */}
          {choice && choice.kind !== "dlc" && (
            <div className="mt-3 flex flex-wrap items-center gap-3 pl-7">
              <div className="flex rounded-lg border border-line bg-panel p-0.5 text-[12px]" role="radiogroup" aria-label={t("identify.row.fileType")}>
                {(["base", "update"] as const).map((k) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={choice.kind === k}
                    onClick={() =>
                      setChoice({
                        ...choice,
                        kind: k,
                        titleId: k === "base" ? choice.baseId : `${choice.baseId.slice(0, 13)}800`,
                        version: k === "base" ? 0 : choice.kind === "update" ? choice.version : null,
                      })
                    }
                    className={cx("rounded-md px-2.5 py-1", choice.kind === k ? "bg-raised font-medium shadow-card" : "text-mute")}
                  >
                    {k === "base" ? t("identify.row.base") : t("identify.row.update")}
                  </button>
                ))}
              </div>
              {choice.kind === "update" && (
                <label className="flex items-center gap-2 text-[12px]">
                  <span className={needsVersion ? "text-danger" : "text-mute"}>{t("identify.row.version")}</span>
                  <Input
                    type="number"
                    min={65536}
                    step={65536}
                    placeholder={t("identify.row.versionPlaceholder")}
                    value={choice.version ?? ""}
                    onChange={(e) => setChoice({ ...choice, version: e.target.value ? Number(e.target.value) : null })}
                    className="data h-8 w-32 text-[12px]"
                  />
                  {choice.version ? (
                    <span className="data text-[11px] text-mute">
                      {t("identify.row.versionIs", { number: Math.round(choice.version / 65536) })}
                    </span>
                  ) : (
                    <span className="text-[11px] text-mute">{t("identify.row.versionHint")}</span>
                  )}
                </label>
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {picking && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Picker
                  initial={ident?.candidates ?? []}
                  fileName={file.name}
                  onPick={(c) => {
                    const kind = kindOf(c.titleId);
                    setChoice({
                      titleId: c.titleId,
                      baseId: c.titleId,
                      name: c.name,
                      iconUrl: c.iconUrl,
                      kind,
                      version: kind === "update" ? null : 0,
                    });
                    setPicking(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.li>
  );
}

function Picker({ initial, fileName, onPick }: { initial: Candidate[]; fileName: string; onPick: (c: Candidate) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const search = useQuery({
    queryKey: ["identify-search", debounced],
    queryFn: () => api<{ candidates: Candidate[] }>(`/identify/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  });
  const list = debounced.length >= 2 ? (search.data?.candidates ?? []) : initial;

  return (
    <div className="mt-3 rounded-xl border border-line bg-panel p-3 pl-7">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("identify.picker.placeholder", { example: fileName.replace(/\.[^.]+$/, "").slice(0, 24) })}
          className="pl-9"
          aria-label={t("identify.picker.label")}
        />
      </div>
      <ul className="mt-2 flex max-h-72 flex-col overflow-y-auto">
        {list.length === 0 && (
          <li className="px-2 py-4 text-center text-[13px] text-mute">
            {search.isFetching ? t("identify.picker.searching") : t("identify.picker.empty")}
          </li>
        )}
        {list.map((c) => (
          <li key={c.titleId}>
            <button
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-raised"
            >
              <div className="size-9 shrink-0 overflow-hidden rounded-md bg-shell">
                <LabelArt src={c.iconUrl} name={c.name} seed={c.titleId} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{prettyTitle(c.name)}</p>
                <p className="data text-[10px] text-mute">
                  {c.titleId} · {c.kind === "dlc" ? t("identify.picker.dlc") : t("identify.picker.game")}
                </p>
              </div>
              <span className="data shrink-0 text-[11px] text-mute">{Math.round(c.score * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DoneList({ done, setDone }: { done: Done[]; setDone: (fn: (d: Done[]) => Done[]) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const undo = useMutation({
    mutationFn: (d: Done) => api(`/identify/undo/${d.renameId}`, { method: "POST" }),
    onSuccess: (_, d) => {
      setDone((list) => list.map((x) => (x.renameId === d.renameId ? { ...x, undone: true } : x)));
      toast(t("identify.done.restored", { name: d.oldName }));
      void qc.invalidateQueries({ queryKey: ["identify-pending"] });
      void qc.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (e) => toast(e.message, "error"),
  });
  if (!done.length) return null;
  return (
    <section className="mb-6 rounded-2xl border border-line bg-panel p-4">
      <h2 className="eyebrow mb-3 flex items-center gap-2">
        <FileSearch className="size-3.5" /> {t("identify.done.title")}
      </h2>
      <ul className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {done.map((d) => (
            <motion.li
              key={d.renameId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-center gap-3 text-[12px]"
            >
              <Check className={cx("size-3.5 shrink-0", d.undone ? "text-faint" : "text-ok")} />
              <span className={cx("data min-w-0 flex-1 truncate", d.undone && "text-faint line-through")} title={d.newName}>
                {d.newName}
              </span>
              {!d.undone && (
                <button
                  onClick={() => undo.mutate(d)}
                  className="inline-flex shrink-0 items-center gap-1 text-mute hover:text-ink"
                  disabled={undo.isPending}
                >
                  <Undo2 className="size-3.5" /> {t("identify.done.undo")}
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
