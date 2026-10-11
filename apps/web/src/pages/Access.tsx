import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { KeyRound, Plus, Trash2, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, CopyField, cx, Field, Input, PageHeader, Section, Switch, useToast } from "../components/ui";
import { api, type Console, type StoreSettings, type StoreUser } from "../lib/api";
import { ago } from "../lib/format";

export function AccessPage() {
  return (
    <>
      <PageHeader title="Acesso" meta="Quem pode abrir a store no Tinfoil e quais consoles já se conectaram." />
      <div className="flex flex-col gap-6">
        <UsersSection />
        <ConsolesSection />
        <PanelPasswordSection />
      </div>
    </>
  );
}

function UsersSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const users = useQuery({ queryKey: ["store-users"], queryFn: () => api<{ users: StoreUser[] }>("/access/users") });
  const [username, setUsername] = useState("");
  const [revealed, setRevealed] = useState<{ username: string; password: string } | null>(null);

  const create = useMutation({
    mutationFn: () => api<{ username: string; password: string }>("/access/users", { method: "POST", json: { username } }),
    onSuccess: (creds) => {
      setRevealed(creds);
      setUsername("");
      void qc.invalidateQueries({ queryKey: ["store-users"] });
    },
    onError: (e) => toast(e.message, "error"),
  });
  const reset = useMutation({
    mutationFn: (id: string) => api<{ username: string; password: string }>(`/access/users/${id}/reset`, { method: "POST" }),
    onSuccess: (creds) => setRevealed(creds),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/access/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Usuário removido. Consoles que usavam esse login perdem o acesso.");
      void qc.invalidateQueries({ queryKey: ["store-users"] });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Section
      title="Usuários da store"
      description="O login que você digita no Tinfoil. Crie um para você e outros para quem você quiser liberar."
    >
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-5 rounded-2xl bg-pin-dim/50 p-4 text-ink ring-1 ring-pin/40 dark:bg-shell dark:text-white dark:ring-shell-edge">
              <p className="text-sm font-medium">Senha de {revealed.username}</p>
              <p className="mt-1 text-[13px] text-mute dark:text-white/60">Anote agora. Ela não aparece de novo, mas você pode gerar outra.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 [&>div]:bg-raised dark:[&>div]:border-white/10 dark:[&>div]:bg-white/5 dark:[&_*]:text-white">
                <CopyField label="Usuário" value={revealed.username} />
                <CopyField label="Senha" value={revealed.password} display={revealed.password.replace(/(.{4})(?=.)/g, "$1 ")} />
              </div>
              <p className="mt-2 text-[12px] text-mute dark:text-white/60">
                Os espaços são só para facilitar a leitura e não fazem parte da senha. No Switch, digite tudo junto; o
                botão de copiar já copia sem espaços.
              </p>
              <button onClick={() => setRevealed(null)} className="mt-3 text-[13px] font-medium text-ink hover:underline dark:text-pin">
                Já anotei
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
        <AnimatePresence initial={false}>
          {(users.data?.users ?? []).map((u) => (
            <motion.li
              key={u.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <UserRound className="size-4 text-mute" />
              <span className="data text-[13px]">{u.username}</span>
              <span className="text-[12px] text-mute">último acesso {ago(u.lastUsedAt)}</span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" icon={<KeyRound className="size-3.5" />} onClick={() => reset.mutate(u.id)} loading={reset.isPending && reset.variables === u.id}>
                  Nova senha
                </Button>
                <button
                  onClick={() => remove.mutate(u.id)}
                  aria-label={`Remover ${u.username}`}
                  className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {users.data && users.data.users.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-mute">
            Sem usuários, a store recusa qualquer acesso. Crie o primeiro abaixo.
          </li>
        )}
      </ul>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="nome do usuário, ex.: switch-sala"
          aria-label="Nome do novo usuário"
          className="max-w-xs"
        />
        <Button type="submit" icon={<Plus className="size-4" />} loading={create.isPending} disabled={!username.trim()}>
          Criar usuário
        </Button>
      </form>
    </Section>
  );
}

function ConsolesSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const consoles = useQuery({ queryKey: ["consoles"], queryFn: () => api<{ consoles: Console[] }>("/access/consoles") });
  const settings = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => api<{ settings: StoreSettings }>("/access/settings"),
  });
  const update = useMutation({
    mutationFn: ({ uid, ...body }: { uid: string; label?: string; allowed?: boolean }) =>
      api(`/access/consoles/${uid}`, { method: "PATCH", json: body }),
    onMutate: async ({ uid, ...body }) => {
      qc.setQueryData<{ consoles: Console[] }>(["consoles"], (d) =>
        d ? { consoles: d.consoles.map((c) => (c.uid === uid ? { ...c, ...body } : c)) } : d,
      );
    },
  });
  const remove = useMutation({
    mutationFn: (uid: string) => api(`/access/consoles/${uid}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["consoles"] }),
  });
  const saveSettings = useMutation({
    mutationFn: (next: StoreSettings) => api("/access/settings", { method: "PUT", json: next }),
    onSuccess: (_, next) => {
      toast(next.requireApproval ? "Agora só consoles aprovados abrem a store." : "Qualquer console com login abre a store.");
      void qc.invalidateQueries({ queryKey: ["store-settings"] });
    },
    onError: (e) => toast(e.message, "error"),
  });

  const s = settings.data?.settings;
  const list = consoles.data?.consoles ?? [];

  return (
    <Section
      title="Consoles"
      description="O Tinfoil envia um identificador do console (UID) a cada acesso. Aprove só os seus para bloquear logins vazados."
      actions={
        s && (
          <label className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-2.5">
            <span className="text-[13px]">Só consoles aprovados</span>
            <Switch
              checked={s.requireApproval}
              onChange={(v) => saveSettings.mutate({ ...s, requireApproval: v })}
              label="Só consoles aprovados"
            />
          </label>
        )
      }
    >
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-mute">
          Nenhum console conectou ainda. Ele aparece aqui depois do primeiro acesso pelo Tinfoil.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <motion.li
              key={c.uid}
              layout
              className={cx(
                "rounded-2xl border bg-raised p-4 transition-colors",
                c.allowed ? "border-line" : s?.requireApproval ? "border-pin/60" : "border-line",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    defaultValue={c.label ?? ""}
                    placeholder="Dar um nome (ex.: Switch da sala)"
                    onBlur={(e) => e.target.value !== (c.label ?? "") && update.mutate({ uid: c.uid, label: e.target.value })}
                    className="w-full rounded-md bg-transparent text-sm font-medium placeholder:font-normal placeholder:text-faint focus:outline-none"
                    aria-label="Nome do console"
                  />
                  <p className="data mt-1 truncate text-[11px] text-mute" title={c.uid}>
                    {c.uid}
                  </p>
                </div>
                <Switch checked={c.allowed} onChange={(v) => update.mutate({ uid: c.uid, allowed: v })} label="Aprovado" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-mute">
                <span>{c.allowed ? "Aprovado" : "Não aprovado"}</span>
                <span>visto {ago(c.lastSeen)}</span>
                {c.version && <span className="data text-[11px]">Tinfoil {c.version}</span>}
                <span className="data text-[11px]">{c.hits} acessos</span>
                <button onClick={() => remove.mutate(c.uid)} className="ml-auto text-faint hover:text-danger" aria-label="Esquecer console">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function PanelPasswordSection() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const change = useMutation({
    mutationFn: () => api("/auth/password", { method: "POST", json: { current, password } }),
    onSuccess: () => {
      toast("Senha do painel alterada. Outras sessões foram desconectadas.");
      setCurrent("");
      setPassword("");
    },
    onError: (e) => toast(e.message, "error"),
  });
  return (
    <Section title="Senha do painel" description="Trocar a senha desconecta todos os navegadores, menos este.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
        className="grid max-w-2xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field label="Senha atual">
          {(id) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}
        </Field>
        <Field label="Nova senha">
          {(id) => <Input id={id} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        <Button type="submit" loading={change.isPending}>
          Trocar senha
        </Button>
      </form>
    </Section>
  );
}
