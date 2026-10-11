import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { ProviderIcon, providerLabel } from "../components/ProviderIcon";
import { Button, CopyField, cx, Field, Input, Modal, PageHeader, Spinner, StatusDot, Switch, useToast } from "../components/ui";
import { Trans, useI18n } from "../i18n";
import { api, type Integration, type IntegrationType } from "../lib/api";
import { ago, bytes } from "../lib/format";

type ListResponse = { integrations: Integration[]; redirectUri: string };

export function IntegrationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const list = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<ListResponse>("/integrations"),
    refetchInterval: (q) => (q.state.data?.integrations.some((i) => i.status === "syncing") ? 2000 : false),
  });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast(t("integrations.connectedToast"));
    if (error) toast(error, "error");
    if (connected || error) {
      setParams({}, { replace: true });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [params, setParams, toast, qc]);

  const items = list.data?.integrations ?? [];

  return (
    <>
      <PageHeader
        title={t("integrations.title")}
        meta={t("integrations.meta")}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            {t("integrations.add")}
          </Button>
        }
      />

      {list.isLoading ? (
        <Spinner className="mx-auto mt-16 size-6" />
      ) : items.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {(["gdrive", "s3", "local"] as IntegrationType[]).map((type) => (
            <TypeCard key={type} type={type} onClick={() => setAdding(true)} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {items.map((i) => (
              <IntegrationCard key={i.id} integration={i} onEdit={() => setEditing(i)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddModal open={adding} onClose={() => setAdding(false)} redirectUri={list.data?.redirectUri ?? ""} />
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("integrations.editTitle", { name: editing?.name ?? "" })} wide>
        {editing && (
          <IntegrationForm
            type={editing.type}
            initial={editing}
            redirectUri={list.data?.redirectUri ?? ""}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function TypeCard({ type, onClick }: { type: IntegrationType; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-4 rounded-3xl border border-line bg-panel p-6 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-signal"
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-raised shadow-card">
        <ProviderIcon type={type} className="size-6" />
      </div>
      <div>
        <p className="display-narrow text-xl">{providerLabel(type)}</p>
        <p className="mt-1.5 text-sm text-mute">{t(`integrations.typeCopy.${type}`)}</p>
      </div>
    </button>
  );
}

function IntegrationCard({ integration: i, onEdit }: { integration: Integration; onEdit: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });

  const sync = useMutation({
    mutationFn: () => api<{ integration: Integration }>(`/integrations/${i.id}/sync`, { method: "POST" }),
    onSuccess: ({ integration }) => {
      if (integration.status === "error") toast(integration.detail.message ?? t("integrations.syncFailed"), "error");
      else toast(t("integrations.syncDone", { name: integration.name, count: integration.fileCount }));
      void refresh();
      void qc.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (e) => toast(e.message, "error"),
  });
  const connect = useMutation({
    mutationFn: () => api<{ authUrl: string }>(`/integrations/${i.id}/connect`),
    onSuccess: ({ authUrl }) => (window.location.href = authUrl),
  });
  const remove = useMutation({
    mutationFn: () => api(`/integrations/${i.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast(t("integrations.removedToast", { name: i.name }));
      void refresh();
      void qc.invalidateQueries({ queryKey: ["files"] });
    },
  });

  const acc = i.detail.account;
  const pct = acc?.totalBytes ? Math.min(((acc.usedBytes ?? 0) / acc.totalBytes) * 100, 100) : null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex flex-col rounded-3xl border border-line bg-panel p-5"
    >
      <div className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-raised shadow-card">
          <ProviderIcon type={i.type} className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="display-narrow truncate text-xl">{i.name}</h3>
          <p className="truncate text-[13px] text-mute">{acc?.label ?? providerLabel(i.type)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-raised px-2.5 py-1">
          <StatusDot status={i.status} />
          <span className="text-[12px]">{t(`integrations.status.${i.status}`)}</span>
        </div>
      </div>

      {i.status === "error" && i.detail.message && (
        <p className="data mt-4 rounded-xl bg-danger-soft px-3 py-2 text-[11px] leading-relaxed break-words text-danger">
          {i.detail.message}
        </p>
      )}

      {pct !== null && (
        <div className="mt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-full rounded-full bg-signal"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
          <p className="data mt-2 text-[11px] text-mute">
            {t("integrations.usage", { used: bytes(acc!.usedBytes ?? 0), total: bytes(acc!.totalBytes!) })}
          </p>
        </div>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <Stat label={t("integrations.stats.files")} value={String(i.fileCount)} />
        <Stat label={t("integrations.stats.inStore")} value={bytes(i.totalBytes)} />
        <Stat label={t("integrations.stats.synced")} value={ago(i.lastSyncAt)} />
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {i.status === "pending" ? (
          <Button variant="primary" size="sm" loading={connect.isPending} onClick={() => connect.mutate()} icon={<ExternalLink className="size-3.5" />}>
            {t("integrations.authorize")}
          </Button>
        ) : (
          <Button
            size="sm"
            loading={sync.isPending || i.status === "syncing"}
            onClick={() => sync.mutate()}
            icon={<RefreshCw className="size-3.5" />}
          >
            {t("integrations.sync")}
          </Button>
        )}
        {i.type === "gdrive" && i.status !== "pending" && (
          <Button size="sm" variant="ghost" onClick={() => connect.mutate()}>
            {t("integrations.reconnect")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit} icon={<Pencil className="size-3.5" />}>
          {t("integrations.edit")}
        </Button>
        <div className="ml-auto">
          <AnimatePresence mode="wait" initial={false}>
            {confirmDelete ? (
              <motion.div key="c" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  {t("integrations.keep")}
                </Button>
                <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                  {t("integrations.remove")}
                </Button>
              </motion.div>
            ) : (
              <motion.button
                key="t"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setConfirmDelete(true)}
                aria-label={t("integrations.removeLabel", { name: i.name })}
                className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="data mt-1 truncate text-[13px]">{value}</dd>
    </div>
  );
}

function AddModal({ open, onClose, redirectUri }: { open: boolean; onClose: () => void; redirectUri: string }) {
  const { t } = useI18n();
  const [type, setType] = useState<IntegrationType | null>(null);
  useEffect(() => {
    if (!open) setTimeout(() => setType(null), 250);
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={type ? providerLabel(type) : t("integrations.add")} wide>
      <AnimatePresence mode="wait" initial={false}>
        {type ? (
          <motion.div key={type} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setType(null)} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-ink">
              <ArrowLeft className="size-3.5" /> {t("integrations.otherType")}
            </button>
            <IntegrationForm type={type} redirectUri={redirectUri} onDone={onClose} />
          </motion.div>
        ) : (
          <motion.div key="pick" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-2.5">
            {(["gdrive", "s3", "local"] as IntegrationType[]).map((option) => (
              <button
                key={option}
                onClick={() => setType(option)}
                className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 text-left transition-colors hover:border-signal"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-raised shadow-card">
                  <ProviderIcon type={option} className="size-6" />
                </div>
                <div>
                  <p className="font-medium">{providerLabel(option)}</p>
                  <p className="mt-0.5 text-[13px] text-mute">{t(`integrations.typeCopy.${option}`)}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

type FormState = Record<string, string | boolean>;

function IntegrationForm({
  type,
  initial,
  redirectUri,
  onDone,
}: {
  type: IntegrationType;
  initial?: Integration;
  redirectUri: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const editing = !!initial;
  const cfg = (initial?.config ?? {}) as Record<string, string | boolean>;
  const [form, setForm] = useState<FormState>(() => ({
    name: initial?.name ?? "",
    path: cfg.path ?? "/data/games",
    endpoint: cfg.endpoint ?? "",
    publicEndpoint: cfg.publicEndpoint ?? "",
    region: cfg.region ?? "auto",
    bucket: cfg.bucket ?? "",
    prefix: cfg.prefix ?? "",
    accessKeyId: cfg.accessKeyId ?? "",
    secretAccessKey: "",
    forcePathStyle: cfg.forcePathStyle ?? false,
    mode: cfg.mode ?? "redirect",
    clientId: cfg.clientId ?? "",
    clientSecret: "",
    folderName: cfg.folderName ?? "Tinfoil",
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: string) => ({
    value: String(form[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k)(e.target.value),
  });

  const save = useMutation({
    mutationFn: async () => {
      const config =
        type === "local"
          ? { path: form.path }
          : type === "s3"
            ? {
                endpoint: form.endpoint,
                publicEndpoint: form.publicEndpoint,
                region: form.region,
                bucket: form.bucket,
                prefix: form.prefix,
                accessKeyId: form.accessKeyId,
                secretAccessKey: form.secretAccessKey,
                forcePathStyle: form.forcePathStyle,
                mode: form.mode,
              }
            : { clientId: form.clientId, clientSecret: form.clientSecret, folderName: form.folderName };
      if (editing) {
        return api<{ integration: Integration; authUrl?: string }>(`/integrations/${initial!.id}`, {
          method: "PATCH",
          json: { name: form.name, config },
        });
      }
      return api<{ integration: Integration; authUrl?: string }>("/integrations", {
        method: "POST",
        json: { type, name: form.name, config },
      });
    },
    onSuccess: ({ integration, authUrl }) => {
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["files"] });
      if (authUrl) {
        window.location.href = authUrl;
        return;
      }
      if (integration.status === "error") {
        setError(integration.detail.message ?? t("integrations.connectFailed"));
        return;
      }
      toast(editing ? t("integrations.savedToast") : t("integrations.connectedNamed", { name: integration.name }));
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate();
  };

  const secretHint = editing ? t("integrations.secretHint") : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("integrations.name.label")} hint={t("integrations.name.hint")}>
        {(id) => <Input id={id} placeholder={providerLabel(type)} {...text("name")} />}
      </Field>

      {type === "local" && (
        <Field label={t("integrations.local.path")} hint={t("integrations.local.pathHint")}>
          {(id) => <Input id={id} required className="data text-[12px]" {...text("path")} />}
        </Field>
      )}

      {type === "gdrive" && (
        <>
          {!editing && <DriveSteps redirectUri={redirectUri} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("integrations.fields.clientId")}>{(id) => <Input id={id} required className="data text-[12px]" {...text("clientId")} />}</Field>
            <Field label={t("integrations.fields.clientSecret")} hint={secretHint}>
              {(id) => <Input id={id} type="password" required={!editing} className="data text-[12px]" {...text("clientSecret")} />}
            </Field>
          </div>
          <Field label={t("integrations.gdrive.folder")} hint={t("integrations.gdrive.folderHint")}>
            {(id) => <Input id={id} {...text("folderName")} />}
          </Field>
        </>
      )}

      {type === "s3" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("integrations.fields.bucket")}>{(id) => <Input id={id} required {...text("bucket")} />}</Field>
            <Field label={t("integrations.s3.prefix")} hint={t("integrations.s3.prefixHint")}>
              {(id) => <Input id={id} {...text("prefix")} />}
            </Field>
            <Field label={t("integrations.fields.endpoint")} hint={t("integrations.s3.endpointHint")}>
              {(id) => <Input id={id} className="data text-[12px]" {...text("endpoint")} />}
            </Field>
            <Field label={t("integrations.s3.region")} hint={t("integrations.s3.regionHint")}>
              {(id) => <Input id={id} {...text("region")} />}
            </Field>
            <Field label={t("integrations.fields.accessKeyId")}>{(id) => <Input id={id} required className="data text-[12px]" {...text("accessKeyId")} />}</Field>
            <Field label={t("integrations.fields.secretAccessKey")} hint={secretHint}>
              {(id) => <Input id={id} type="password" required={!editing} className="data text-[12px]" {...text("secretAccessKey")} />}
            </Field>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium">{t("integrations.s3.downloadMode")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeOption
                selected={form.mode === "redirect"}
                onSelect={() => set("mode")("redirect")}
                title={t("integrations.s3.redirectTitle")}
                body={t("integrations.s3.redirectBody")}
              />
              <ModeOption
                selected={form.mode === "proxy"}
                onSelect={() => set("mode")("proxy")}
                title={t("integrations.s3.proxyTitle")}
                body={t("integrations.s3.proxyBody")}
              />
            </div>
          </div>

          <details className="group rounded-2xl border border-line bg-panel px-4 py-3">
            <summary className="cursor-pointer text-[13px] font-medium text-mute group-open:text-ink">{t("integrations.s3.advanced")}</summary>
            <div className="mt-4 flex flex-col gap-4">
              <Field label={t("integrations.s3.publicEndpoint")} hint={t("integrations.s3.publicEndpointHint")}>
                {(id) => <Input id={id} className="data text-[12px]" placeholder={t("integrations.fields.publicEndpointPlaceholder")} {...text("publicEndpoint")} />}
              </Field>
              <label className="flex items-center justify-between gap-4">
                <span className="text-[13px]">{t("integrations.s3.pathStyle")}</span>
                <Switch checked={Boolean(form.forcePathStyle)} onChange={set("forcePathStyle")} label={t("integrations.fields.pathStyle")} />
              </label>
              <div>
                <p className="mb-2 text-[13px]">
                  {t("integrations.s3.cors")} <span className="text-mute">{t("integrations.s3.corsEtag")}</span>
                </p>
                <CopyField
                  value={JSON.stringify([
                    { AllowedOrigins: [window.location.origin], AllowedMethods: ["GET", "PUT", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 },
                  ])}
                />
              </div>
            </div>
          </details>
        </>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            className="data rounded-xl bg-danger-soft px-3 py-2.5 text-[11px] leading-relaxed text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {editing ? t("integrations.submit.save") : type === "gdrive" ? t("integrations.submit.google") : t("integrations.submit.connect")}
        </Button>
      </div>
    </form>
  );
}

function ModeOption({ selected, onSelect, title, body }: { selected: boolean; onSelect: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "rounded-2xl border p-3.5 text-left transition-[border-color,box-shadow]",
        selected ? "border-signal bg-raised shadow-[0_0_0_3px_var(--signal-soft)]" : "border-line bg-panel hover:border-faint",
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-mute">{body}</p>
    </button>
  );
}

function DriveSteps({ redirectUri }: { redirectUri: string }) {
  const markup = {
    i: <i />,
    link: (
      <a
        className="text-signal underline-offset-2 hover:underline"
        href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
        target="_blank"
        rel="noreferrer"
      />
    ),
  };
  const steps: ReactNode[] = [
    <Trans k="integrations.gdrive.steps.step1" components={markup} />,
    <Trans k="integrations.gdrive.steps.step2" components={markup} />,
    <>
      <Trans k="integrations.gdrive.steps.step3" components={markup} />
      <div className="mt-2">
        <CopyField value={redirectUri} />
      </div>
    </>,
    <Trans k="integrations.gdrive.steps.step4" components={markup} />,
  ];
  return (
    <ol className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-[13px] leading-relaxed">
          <span className="data grid size-5 shrink-0 place-items-center rounded-md bg-raised text-[10px] text-mute shadow-card">{i + 1}</span>
          <div className="min-w-0 flex-1">{s}</div>
        </li>
      ))}
    </ol>
  );
}
