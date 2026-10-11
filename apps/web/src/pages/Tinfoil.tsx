import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Pins } from "../components/Cartridge";
import { ProviderIcon } from "../components/ProviderIcon";
import { Badge, Button, CopyField, Field, Input, PageHeader, Section, useToast } from "../components/ui";
import { api, type Connection, type Integration, type StoreSettings, type StoreUser } from "../lib/api";
import { ago } from "../lib/format";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function TinfoilPage() {
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
      <PageHeader title="Conectar Tinfoil" meta="Cadastre a store uma vez no console. Depois disso, tudo o que entrar na biblioteca aparece no Tinfoil." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Section title="No console">
          <ol className="flex flex-col gap-4">
            {[
              <>Abra o Tinfoil e vá em <b>File Browser</b>.</>,
              <>Aperte <b>−</b> (menos) para adicionar um novo local.</>,
              <>Preencha os campos como no cartão ao lado. Para a senha, use a do usuário da store.</>,
              <>Aperte <b>X</b> para salvar e volte. Os jogos aparecem em <b>New Games</b> e na própria store.</>,
            ].map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="data grid size-6 shrink-0 place-items-center rounded-lg bg-raised text-[11px] text-mute shadow-card">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          {users.data && users.data.users.length === 0 && (
            <div className="mt-5 rounded-2xl bg-pin-dim px-4 py-3 text-sm">
              Você ainda não tem usuário da store.{" "}
              <Link to="/acesso" className="font-medium underline underline-offset-2">
                Crie um em Acesso
              </Link>{" "}
              antes de conectar.
            </div>
          )}
          {conn && conn.protocol === "http" && conn.host !== "localhost" && (
            <p className="mt-5 rounded-2xl border border-line px-4 py-3 text-[13px] text-mute">
              A store está respondendo em <b>http</b>. Fora de casa, publique atrás de HTTPS (o Traefik do Dokploy faz isso) e
              ajuste o endereço público abaixo.
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
              <p className="eyebrow mb-1 dark:!text-white/50">Valores para o Tinfoil</p>
              <CopyField label="Protocol" value={conn.protocol} />
              <CopyField label="Host" value={conn.host} />
              <CopyField label="Port" value={conn.port} />
              <CopyField label="Path" value={conn.path} />
              <CopyField label="Username" value={firstUser ?? "crie em Acesso"} />
              <CopyField label="Title" value="Cartucho" />
              {LOOPBACK.has(conn.host) && (
                <p className="mt-1 rounded-xl bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger">
                  O Switch não alcança "{conn.host}": esse endereço aponta para o próprio console. Use o IP deste computador
                  na rede (ex.: 192.168.x.x). Abra o painel por esse IP ou preencha o endereço público abaixo.
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
      toast("Configurações da store salvas.");
      void qc.invalidateQueries({ queryKey: ["store-settings"] });
    },
    onError: (e) => toast(e.message, "error"),
  });
  if (!form) return null;
  return (
    <Section title="Store" description="O endereço que vai no índice e a mensagem que o Tinfoil mostra ao abrir.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        <Field
          label="Endereço público"
          hint={`Vazio = detectar pela requisição (hoje: ${query.data?.connection.baseUrl}). Defina quando estiver atrás de proxy ou domínio próprio.`}
        >
          {(id) => (
            <Input id={id} placeholder="https://store.seudominio.com" className="data text-[12px]" value={form.publicUrl} onChange={(e) => setForm({ ...form, publicUrl: e.target.value })} />
          )}
        </Field>
        <Field label="Mensagem de boas-vindas" hint="Aparece num pop-up toda vez que a store carrega. Vazio = sem pop-up.">
          {(id) => (
            <Input id={id} placeholder="Ex.: Bem-vindo de volta!" value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
          )}
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" loading={save.isPending}>
            Salvar store
          </Button>
        </div>
      </form>
    </Section>
  );
}

function DirectDriveSection({ conn }: { conn: Connection }) {
  return (
    <Section
      title="Modo direto do Google Drive"
      description="O console baixa direto do Drive com a sua conta Google, sem passar pelo servidor. Bom para quando você está fora de casa ou numa VPS com pouca banda."
      actions={<Badge tone="pin">experimental</Badge>}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <ol className="flex flex-col gap-3 text-sm leading-relaxed">
          <li className="flex gap-3">
            <ProviderIcon type="gdrive" className="mt-0.5 size-4 shrink-0" />
            <span>
              No Google Cloud, crie mais um ID do cliente OAuth, do tipo <b>App para computador</b>, e baixe o JSON.
            </span>
          </li>
          <li className="flex gap-3">
            <ProviderIcon type="gdrive" className="mt-0.5 size-4 shrink-0" />
            <span>
              Salve no cartão SD como <code className="data text-[12px]">/switch/tinfoil/credentials.json</code> e faça login no Google pelo Tinfoil.
            </span>
          </li>
          <li className="flex gap-3">
            <ProviderIcon type="gdrive" className="mt-0.5 size-4 shrink-0" />
            <span>Cadastre uma segunda store com o caminho abaixo. Os arquivos do Drive saem como links gdrive:, e os outros continuam passando pelo servidor.</span>
          </li>
        </ol>
        <div className="flex flex-col gap-2">
          <CopyField label="Path" value={conn.directPath} />
          <CopyField label="URL" value={`${conn.baseUrl}${conn.directPath}`} />
          <p className="text-[12px] leading-relaxed text-mute">
            O formato gdrive: e o local do credentials.json mudam entre versões do Tinfoil. Teste com um jogo pequeno antes.
          </p>
        </div>
      </div>
    </Section>
  );
}

function TitleDbSection() {
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
      title="Nomes e capas"
      description="Vêm do titledb, uma base pública com os metadados dos jogos. O download tem cerca de 90 MB e roda em segundo plano."
      actions={
        <Button size="sm" icon={<RefreshCw className={s?.state === "running" ? "size-3.5 animate-spin" : "size-3.5"} />} disabled={s?.state === "running"} onClick={() => refresh.mutate()}>
          {s?.state === "running" ? "Atualizando" : "Atualizar agora"}
        </Button>
      }
    >
      <p className="data text-[12px] text-mute">
        {s?.state === "done" && `${s.count?.toLocaleString("pt-BR")} títulos · atualizado ${ago(s.updatedAt)}`}
        {s?.state === "running" && "Baixando e indexando…"}
        {s?.state === "error" && <span className="text-danger">Falhou: {s.error}</span>}
        {s?.state === "idle" && "Ainda não baixado."}
      </p>
    </Section>
  );
}
