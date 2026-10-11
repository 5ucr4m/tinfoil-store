import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Check, Pause, Play, Plug, RotateCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";
import { LabelArt, Pins } from "../components/Cartridge";
import { ProviderIcon, PROVIDER_LABEL } from "../components/ProviderIcon";
import { Badge, Button, cx, PageHeader, Spinner, Switch, useToast } from "../components/ui";
import { api, type Identification, type Integration, type LibraryFile, type TitleInfo } from "../lib/api";
import { readFileHeader } from "../lib/pfs0";
import { bytes, cleanName, duration, KIND_LABEL, prettyTitle } from "../lib/format";
import {
  cancel,
  clearFinished,
  dismiss,
  enqueue,
  isActive,
  pause,
  resume,
  useUploads,
  type UploadItem,
} from "../lib/uploads";

const ACCEPT = [".nsp", ".nsz", ".xci", ".xcz"];
const TARGET_KEY = "cartucho-upload-target";
const AUTOFIX_KEY = "cartucho-upload-autofix";

export function UploadPage() {
  const toast = useToast();
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<{ integrations: Integration[] }>("/integrations"),
  });
  const library = useQuery({ queryKey: ["files"], queryFn: () => api<{ files: LibraryFile[] }>("/files") });
  const ready = (integrations.data?.integrations ?? []).filter((i) => i.status !== "pending");

  const [targetId, setTargetId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TARGET_KEY);
    } catch {
      return null;
    }
  });
  const target = ready.find((i) => i.id === targetId) ?? ready[0];
  useEffect(() => {
    if (!target) return;
    try {
      localStorage.setItem(TARGET_KEY, target.id);
    } catch {}
  }, [target]);

  const uploads = useUploads();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [autoFix, setAutoFix] = useState(() => {
    try {
      return localStorage.getItem(AUTOFIX_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [identifying, setIdentifying] = useState(0);

  /** Files without a title ID in the name: read the header, match titledb, rename when confident. */
  const correctName = async (file: File) => {
    if (!autoFix || /\[[0-9a-fA-F]{16}\]/.test(file.name)) return file.name;
    try {
      const header = await readFileHeader(file);
      const ident = await api<Identification>("/identify/preview", { method: "POST", json: { name: file.name, header } });
      if (ident.suggestedName && ident.confidence === "high" && !ident.needsVersion) return ident.suggestedName;
    } catch {}
    return file.name;
  };

  const addFiles = async (list: FileList | File[]) => {
    if (!target) return;
    const all = Array.from(list);
    const valid = all.filter((f) => ACCEPT.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (valid.length < all.length) toast(`${all.length - valid.length} arquivo(s) ignorado(s): use .nsp, .nsz, .xci ou .xcz.`, "error");

    setIdentifying((n) => n + valid.length);
    const named = await Promise.all(
      valid.map(async (file) => {
        const name = await correctName(file);
        setIdentifying((n) => n - 1);
        return { file, name };
      }),
    );
    const renamed = named.filter((n) => n.name !== n.file.name).length;
    if (renamed) toast(`${renamed} ${renamed === 1 ? "nome corrigido" : "nomes corrigidos"} antes do envio.`, "info");

    const existing = new Set(
      (library.data?.files ?? []).filter((f) => f.integrationId === target.id).map((f) => f.name),
    );
    const queued = new Set(uploads.filter((u) => u.integrationId === target.id && u.state !== "canceled").map((u) => u.name));
    const fresh = named.filter((f) => !existing.has(f.name) && !queued.has(f.name));
    const skipped = named.length - fresh.length;
    if (skipped) toast(`${skipped} arquivo(s) já estão em ${target.name} e foram pulados.`, "info");
    if (fresh.length) enqueue(fresh, { id: target.id, name: target.name, type: target.type });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  if (integrations.isLoading) return <Spinner className="mx-auto mt-24 size-6" />;

  if (!ready.length) {
    return (
      <>
        <PageHeader title="Enviar" />
        <div className="rounded-3xl border border-line bg-panel px-6 py-16 text-center">
          <h2 className="display-narrow text-2xl">Conecte um destino primeiro</h2>
          <p className="mx-auto mt-2 max-w-md text-mute">
            Os arquivos vão direto do seu navegador para o Google Drive, para um bucket S3 ou para uma pasta do servidor.
          </p>
          <Link to="/integracoes" className="mt-6 inline-block">
            <Button variant="primary" icon={<Plug className="size-4" />}>
              Conectar um destino
            </Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Enviar" meta="Os arquivos vão direto do navegador para o destino escolhido, sem passar pelo servidor (exceto na pasta local)." />

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="eyebrow">Destino</h2>
        <Link to="/integracoes" className="text-[13px] text-signal hover:underline">
          Gerenciar integrações
        </Link>
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Destino do upload">
        {ready.map((i) => (
          <TargetCard key={i.id} integration={i} selected={target?.id === i.id} onSelect={() => setTargetId(i.id)} />
        ))}
      </div>

      {/* The slot */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        animate={{ scale: dragging ? 1.01 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cx(
          // Light theme: a pale plastic slot. Dark theme: the console's dark shell.
          "relative overflow-hidden rounded-[28px] bg-panel p-3 ring-1 transition-shadow dark:bg-shell",
          dragging ? "ring-2 ring-pin shadow-[0_0_0_6px_var(--pin-dim)]" : "ring-line dark:ring-shell-edge",
        )}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative flex w-full flex-col items-center justify-center gap-5 rounded-[20px] border border-dashed border-faint/60 bg-raised px-6 py-14 text-center text-ink transition-colors hover:border-signal sm:py-16 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:border-white/30"
        >
          {/* Slot mouth */}
          <div className="relative h-4 w-[min(320px,80%)] rounded-full bg-shell/85 shadow-[inset_0_2px_6px_rgb(0_0_0/0.55)] dark:bg-black/60 dark:shadow-[inset_0_2px_6px_rgb(0_0_0/0.8)]">
            <motion.div
              className="absolute inset-x-6 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-pin"
              animate={{ opacity: dragging ? [0.4, 1, 0.4] : 0.25, scaleX: dragging ? 1 : 0.6 }}
              transition={{ duration: 1, repeat: dragging ? Infinity : 0 }}
            />
          </div>
          <div>
            <p className="display-narrow text-2xl sm:text-3xl">
              {dragging ? `Solte para gravar em ${target?.name}` : "Arraste os arquivos até o slot"}
            </p>
            <p className="mt-2 text-sm text-mute dark:text-white/55">
              ou{" "}
              <span className="text-signal underline decoration-signal/30 underline-offset-4 group-hover:decoration-signal dark:text-white dark:decoration-white/30 dark:group-hover:decoration-white">
                escolha no computador
              </span>{" "}
              · .nsp, .nsz, .xci, .xcz
            </p>
          </div>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </motion.div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <label className="flex items-center gap-3 text-[13px]">
          <Switch
            checked={autoFix}
            onChange={(v) => {
              setAutoFix(v);
              try {
                localStorage.setItem(AUTOFIX_KEY, v ? "on" : "off");
              } catch {}
            }}
            label="Corrigir nomes automaticamente"
          />
          <span>
            Corrigir nomes automaticamente
            <span className="block text-[12px] text-mute">
              Arquivos sem title ID no nome sobem como "Jogo [ID][vN]" quando a identificação é confiável.
            </span>
          </span>
        </label>
        {identifying > 0 && (
          <span className="flex items-center gap-2 text-[13px] text-mute">
            <Spinner /> Identificando {identifying} {identifying === 1 ? "arquivo" : "arquivos"}…
          </span>
        )}
      </div>

      <Queue uploads={uploads} />
    </>
  );
}

function TargetCard({ integration: i, selected, onSelect }: { integration: Integration; selected: boolean; onSelect: () => void }) {
  const acc = i.detail.account;
  const free = acc?.totalBytes ? acc.totalBytes - (acc.usedBytes ?? 0) : null;
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "relative flex items-start gap-3 rounded-2xl border bg-raised p-4 text-left transition-[border-color,box-shadow]",
        selected ? "border-signal shadow-[0_0_0_3px_var(--signal-soft)]" : "border-line hover:border-faint",
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel text-ink">
        <ProviderIcon type={i.type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{i.name}</p>
        <p className="truncate text-[12px] text-mute">{acc?.label ?? PROVIDER_LABEL[i.type]}</p>
        {acc?.totalBytes ? (
          <div className="mt-2.5">
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(((acc.usedBytes ?? 0) / acc.totalBytes) * 100, 100)}%` }} />
            </div>
            <p className="data mt-1.5 text-[10px] text-mute">{bytes(free ?? 0)} livres</p>
          </div>
        ) : null}
      </div>
      <AnimatePresence>
        {selected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="grid size-5 shrink-0 place-items-center rounded-full bg-signal text-signal-ink"
          >
            <Check className="size-3" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function Queue({ uploads }: { uploads: UploadItem[] }) {
  const ids = useMemo(
    () => [...new Set(uploads.map((u) => u.baseId).filter(Boolean) as string[])].sort(),
    [uploads],
  );
  const titles = useQuery({
    queryKey: ["titles", ids.join(",")],
    queryFn: () => api<{ titles: TitleInfo[] }>(`/titles?ids=${ids.join(",")}`),
    enabled: ids.length > 0,
    staleTime: Infinity,
  });
  const byId = new Map((titles.data?.titles ?? []).map((t) => [t.id, t]));

  if (!uploads.length) return null;
  const running = uploads.filter((u) => isActive(u.state) || u.state === "queued");
  const total = running.reduce((s, u) => s + u.size, 0);
  const sent = running.reduce((s, u) => s + u.sent, 0);
  const speed = running.reduce((s, u) => s + u.speed, 0);
  const finished = uploads.filter((u) => u.state === "done" || u.state === "canceled").length;

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display-narrow text-2xl">Fila</h2>
          {running.length > 0 && (
            <p className="data mt-1 text-[12px] text-mute">
              {bytes(sent)} de {bytes(total)} · {bytes(speed)}/s · {speed > 0 ? `faltam ${duration((total - sent) / speed)}` : "calculando"}
            </p>
          )}
        </div>
        {finished > 0 && (
          <Button size="sm" variant="ghost" onClick={clearFinished}>
            Limpar concluídos
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {uploads.map((u) => (
            <QueueRow key={u.key} item={u} title={u.baseId ? byId.get(u.baseId) : undefined} />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

const STATE_LABEL: Record<UploadItem["state"], string> = {
  queued: "Na fila",
  starting: "Abrindo sessão",
  uploading: "Gravando",
  paused: "Pausado",
  finishing: "Finalizando",
  done: "Na biblioteca",
  error: "Falhou",
  canceled: "Cancelado",
};

function QueueRow({ item: u, title }: { item: UploadItem; title?: TitleInfo }) {
  const progress = u.size ? u.sent / u.size : u.state === "done" ? 1 : 0;
  const active = u.state === "uploading";
  const name = title?.name ? prettyTitle(title.name) : cleanName(u.name);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
      className={cx(
        "flex items-center gap-4 rounded-2xl border bg-raised p-3 pr-4 transition-colors",
        u.state === "error" ? "border-danger/40" : "border-line",
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-shell sm:size-16">
        <LabelArt src={title?.iconUrl} name={name} seed={u.baseId ?? u.name} />
        <AnimatePresence>
          {u.state === "done" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 grid place-items-center bg-ok/80 text-white"
            >
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
                <Check className="size-6" strokeWidth={3} />
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium" title={u.name}>
            {name}
          </p>
          <Badge tone={u.kind === "unknown" ? "pin" : "neutral"}>{KIND_LABEL[u.kind]}</Badge>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Pins progress={progress} active={active} count={24} className="hidden sm:flex" />
          <Pins progress={progress} active={active} count={12} className="sm:hidden" />
          <span className="data text-[11px] text-ink">{Math.floor(progress * 100)}%</span>
        </div>
        {u.originalName && (
          <p className="data mt-1 truncate text-[10.5px] text-signal" title={`Nome original: ${u.originalName}`}>
            sobe como {u.name}
          </p>
        )}
        <p className={cx("data mt-1.5 truncate text-[10.5px]", u.state === "error" ? "text-danger" : "text-mute")}>
          {u.state === "error"
            ? u.error
            : u.state === "uploading"
              ? `${bytes(u.sent)} de ${bytes(u.size)} · ${bytes(u.speed)}/s${u.speed > 0 ? ` · ${duration((u.size - u.sent) / u.speed)}` : ""}${u.retrying ? ` · nova tentativa ${u.retrying}` : ""}`
              : `${STATE_LABEL[u.state]} · ${bytes(u.size)} · ${u.integrationName}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {(u.state === "uploading" || u.state === "queued") && (
          <IconButton label="Pausar" onClick={() => pause(u.key)}>
            <Pause className="size-4" />
          </IconButton>
        )}
        {u.state === "paused" && (
          <IconButton label="Continuar" onClick={() => resume(u.key)}>
            <Play className="size-4" />
          </IconButton>
        )}
        {u.state === "error" && (
          <IconButton label="Tentar de novo" onClick={() => resume(u.key)}>
            <RotateCw className="size-4" />
          </IconButton>
        )}
        {u.state === "starting" || u.state === "finishing" ? (
          <Spinner />
        ) : u.state === "done" || u.state === "canceled" ? (
          <IconButton label="Tirar da lista" onClick={() => dismiss(u.key)}>
            <X className="size-4" />
          </IconButton>
        ) : (
          <IconButton label="Cancelar envio" onClick={() => cancel(u.key)} danger>
            <X className="size-4" />
          </IconButton>
        )}
      </div>
    </motion.li>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "grid size-9 place-items-center rounded-xl text-mute transition-colors",
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-panel hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
