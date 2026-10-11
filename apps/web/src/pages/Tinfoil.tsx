import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Pins } from "../components/Cartridge";
import { ProviderIcon } from "../components/ProviderIcon";
import { Badge, Button, CopyField, Field, Input, PageHeader, Section, useToast } from "../components/ui";
import { Trans, useI18n } from "../i18n";
import { api, type Connection, type Integration, type StoreSettings, type StoreUser } from "../lib/api";
import { ago } from "../lib/format";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function TinfoilPage() {
  const { t } = useI18n();
  const settings = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => api<{ settings: StoreSettings; connection: Connection }>("/access/settings"),
  });
  const users = useQuery({ queryKey: ["store-users"], queryFn: () => api<{ users: StoreUser[] }>("/access/users") });
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<{ integrations: Integration[] }>("/integrations"),
  });

  const conn = settings.data?.connection;
  const firstUser = users.data?.users[0]?.username;
  const hasDrive = integrations.data?.integrations.some((i) => i.type === "gdrive");

  return (
    <>
      <PageHeader title={t("tinfoil.title")} meta={t("tinfoil.meta")} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Section title={t("tinfoil.console.title")}>
          <ol className="flex flex-col gap-4">
            {(["tinfoil.console.step1", "tinfoil.console.step2", "tinfoil.console.step3", "tinfoil.console.step4"] as const).map((k, i) => (
              <li key={k} className="flex gap-3 text-sm leading-relaxed">
                <span className="data grid size-6 shrink-0 place-items-center rounded-lg bg-raised text-[11px] text-mute shadow-card">{i + 1}</span>
                <span className="pt-0.5">
                  <Trans k={k} />
                </span>
              </li>
            ))}
          </ol>
          {users.data && users.data.users.length === 0 && (
            <div className="mt-5 rounded-2xl bg-pin-dim px-4 py-3 text-sm">
              <Trans k="tinfoil.console.noUser" components={{ link: <Link to="/access" className="font-medium underline underline-offset-2" /> }} />
            </div>
          )}
          {conn && conn.protocol === "http" && conn.host !== "localhost" && (
            <p className="mt-5 rounded-2xl border border-line px-4 py-3 text-[13px] text-mute">
              <Trans k="tinfoil.console.httpNote" />
            </p>
          )}
        </Section>

        {/* Mirror of Tinfoil's "new location" form */}
        {conn && (
          <div
            className="self-start rounded-[22px] bg-panel p-3 pt-0 text-ink ring-1 ring-line dark:bg-shell dark:text-white dark:ring-shell-edge"
            style={{ clipPath: "polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%)" }}
          >
            <div className="flex h-8 items-center pl-1">
              <Pins progress={1} count={12} size="sm" />
            </div>
            <div className="flex flex-col gap-2 rounded-[14px] bg-raised p-4 dark:bg-black/25 dark:[&>div]:border-white/10 dark:[&>div]:bg-white/5 dark:[&_*]:text-white">
              <p className="eyebrow mb-1 dark:!text-white/50">{t("tinfoil.card.title")}</p>
              <CopyField label={t("tinfoil.fields.protocol")} value={conn.protocol} />
              <CopyField label={t("tinfoil.fields.host")} value={conn.host} />
              <CopyField label={t("tinfoil.fields.port")} value={conn.port} />
              <CopyField label={t("tinfoil.fields.path")} value={conn.path} />
              <CopyField label={t("tinfoil.fields.username")} value={firstUser ?? t("tinfoil.card.createInAccess")} />
              <CopyField label={t("tinfoil.fields.title")} value="Cartucho" />
              {LOOPBACK.has(conn.host) && (
                <p className="mt-1 rounded-xl bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger">
                  {t("tinfoil.card.loopback", { host: conn.host })}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <StoreSettingsSection />
        {hasDrive && conn && <DirectDriveSection conn={conn} />}
        <TitleDbSection />
      </div>
    </>
  );
}

function StoreSettingsSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => api<{ settings: StoreSettings; connection: Connection }>("/access/settings"),
  });
  const [form, setForm] = useState<StoreSettings | null>(null);
  useEffect(() => {
    if (query.data && !form) setForm(query.data.settings);
  }, [query.data, form]);
  const save = useMutation({
    mutationFn: (s: StoreSettings) => api("/access/settings", { method: "PUT", json: s }),
    onSuccess: () => {
      toast(t("tinfoil.store.saved"));
      void qc.invalidateQueries({ queryKey: ["store-settings"] });
    },
    onError: (e) => toast(e.message, "error"),
  });
  if (!form) return null;
  return (
    <Section title={t("tinfoil.store.title")} description={t("tinfoil.store.description")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        <Field
          label={t("tinfoil.store.publicUrl")}
          hint={t("tinfoil.store.publicUrlHint", { url: query.data?.connection.baseUrl ?? "" })}
        >
          {(id) => (
            <Input id={id} placeholder={t("tinfoil.store.publicUrlPlaceholder")} className="data text-[12px]" value={form.publicUrl} onChange={(e) => setForm({ ...form, publicUrl: e.target.value })} />
          )}
        </Field>
        <Field label={t("tinfoil.store.welcome")} hint={t("tinfoil.store.welcomeHint")}>
          {(id) => (
            <Input id={id} placeholder={t("tinfoil.store.welcomePlaceholder")} value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
          )}
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {t("tinfoil.store.save")}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function DirectDriveSection({ conn }: { conn: Connection }) {
  const { t } = useI18n();
  return (
    <Section
      title={t("tinfoil.direct.title")}
      description={t("tinfoil.direct.description")}
      actions={<Badge tone="pin">{t("tinfoil.direct.experimental")}</Badge>}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <ol className="flex flex-col gap-3 text-sm leading-relaxed">
          <li className="flex gap-3">
            <ProviderIcon type="gdrive" className="mt-0.5 size-4 shrink-0" />
            <span>
              <Trans k="tinfoil.direct.step1" />
            </span>
          </li>
          <li className="flex gap-3">
            <ProviderIcon type="gdrive" className="mt-0.5 size-4 shrink-0" />
            <span>
              <Trans k="tinfoil.direct.step2" components={{ code: <code className="data text-[12px]" /> }} />
            </span>
          </li>
          <li className="flex gap-3">
            <ProviderIcon type="gdrive" className="mt-0.5 size-4 shrink-0" />
            <span>{t("tinfoil.direct.step3")}</span>
          </li>
        </ol>
        <div className="flex flex-col gap-2">
          <CopyField label={t("tinfoil.fields.path")} value={conn.directPath} />
          <CopyField label={t("tinfoil.fields.url")} value={`${conn.baseUrl}${conn.directPath}`} />
          <p className="text-[12px] leading-relaxed text-mute">
            {t("tinfoil.direct.note")}
          </p>
        </div>
      </div>
    </Section>
  );
}

function TitleDbSection() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["titledb"],
    queryFn: () => api<{ state: string; count?: number; updatedAt?: number; error?: string }>("/titles/status"),
    refetchInterval: (q) => (q.state.data?.state === "running" ? 2500 : false),
  });
  const refresh = useMutation({
    mutationFn: () => api("/titles/refresh", { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["titledb"] }),
  });
  const s = status.data;
  useEffect(() => {
    if (s?.state === "done") void qc.invalidateQueries({ queryKey: ["files"] });
  }, [s?.state, qc]);
  return (
    <Section
      title={t("tinfoil.titledb.title")}
      description={t("tinfoil.titledb.description")}
      actions={
        <Button size="sm" icon={<RefreshCw className={s?.state === "running" ? "size-3.5 animate-spin" : "size-3.5"} />} disabled={s?.state === "running"} onClick={() => refresh.mutate()}>
          {s?.state === "running" ? t("tinfoil.titledb.refreshing") : t("tinfoil.titledb.refresh")}
        </Button>
      }
    >
      <p className="data text-[12px] text-mute">
        {s?.state === "done" &&
          t("tinfoil.titledb.done", {
            count: s.count ?? 0,
            total: (s.count ?? 0).toLocaleString(locale),
            when: ago(s.updatedAt),
          })}
        {s?.state === "running" && t("tinfoil.titledb.running")}
        {s?.state === "error" && <span className="text-danger">{t("tinfoil.titledb.failed", { error: s.error ?? "" })}</span>}
        {s?.state === "idle" && t("tinfoil.titledb.idle")}
      </p>
    </Section>
  );
}
