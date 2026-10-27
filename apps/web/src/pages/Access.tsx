import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RoleMark, RoleTag, roleLabel } from "../components/RoleMark";
import { Button, CopyField, cx, Input, PageHeader, Section, Switch, useToast } from "../components/ui";
import { useI18n } from "../i18n";
import { api, type Account, type Console, type Role, type StoreSettings } from "../lib/api";
import { ago } from "../lib/format";
import { useSession } from "../lib/session";

export function AccessPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("access.title")} meta={t("access.meta")} />
      <div className="flex flex-col gap-6">
        <PeopleSection />
        <ConsolesSection />
      </div>
    </>
  );
}

const ROLES: Role[] = ["admin", "user"];

/** Two states, so a segmented control rather than a dropdown: both options stay visible. */
function RoleChoice({ value, onChange, label }: { value: Role; onChange: (role: Role) => void; label: string }) {
  const { t } = useI18n();
  return (
    <div className="flex rounded-lg border border-line bg-panel p-0.5 text-[12px]" role="radiogroup" aria-label={label}>
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          onClick={() => onChange(role)}
          className={cx(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
            value === role ? "bg-raised font-medium shadow-card" : "text-mute hover:text-ink",
          )}
        >
          <RoleMark role={role} className={cx("size-3", value === role && role === "admin" && "text-signal")} />
          {t(roleLabel(role))}
        </button>
      ))}
    </div>
  );
}

function PeopleSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me } = useSession();
  const people = useQuery({ queryKey: ["people"], queryFn: () => api<{ users: Account[] }>("/access/users") });
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [revealed, setRevealed] = useState<{ username: string; password: string } | null>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["people"] });

  const create = useMutation({
    mutationFn: () => api<{ username: string; password: string }>("/access/users", { method: "POST", json: { username, role } }),
    onSuccess: (creds) => {
      setRevealed(creds);
      setUsername("");
      invalidate();
    },
    onError: (e) => toast(e.message, "error"),
  });
  const reset = useMutation({
    mutationFn: (id: string) => api<{ username: string; password: string }>(`/access/users/${id}/reset`, { method: "POST" }),
    onSuccess: (creds) => setRevealed(creds),
    onError: (e) => toast(e.message, "error"),
  });
  const patch = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; tinfoilEnabled?: boolean }) =>
      api(`/access/users/${id}`, { method: "PATCH", json: body }),
    onSuccess: invalidate,
    onError: (e) => {
      toast(e.message, "error");
      invalidate();
    },
    onMutate: ({ id, ...body }) => {
      qc.setQueryData<{ users: Account[] }>(["people"], (d) =>
        d ? { users: d.users.map((u) => (u.id === id ? { ...u, ...body } : u)) } : d,
      );
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/access/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast(t("access.people.removed"));
      invalidate();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Section title={t("access.people.title")} description={t("access.people.description")}>
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-5 rounded-2xl bg-pin-dim/50 p-4 text-ink ring-1 ring-pin/40 dark:bg-shell dark:text-white dark:ring-shell-edge">
              <p className="text-sm font-medium">{t("access.people.revealTitle", { username: revealed.username })}</p>
              <p className="mt-1 text-[13px] text-mute dark:text-white/60">{t("access.people.revealNote")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 [&>div]:bg-raised dark:[&>div]:border-white/10 dark:[&>div]:bg-white/5 dark:[&_*]:text-white">
                <CopyField label={t("access.people.username")} value={revealed.username} />
                <CopyField
                  label={t("access.people.password")}
                  value={revealed.password}
                  display={revealed.password.replace(/(.{4})(?=.)/g, "$1 ")}
                />
              </div>
              <p className="mt-2 text-[12px] text-mute dark:text-white/60">{t("access.people.readabilityNote")}</p>
              <button onClick={() => setRevealed(null)} className="mt-3 text-[13px] font-medium text-ink hover:underline dark:text-pin">
                {t("access.people.done")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
        <AnimatePresence initial={false}>
          {(people.data?.users ?? []).map((u) => {
            const isMe = u.id === me.id;
            return (
              <motion.li
                key={u.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-2.5 px-4 py-3.5"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <RoleMark role={u.role} className={cx("size-4", u.role === "admin" ? "text-signal" : "text-mute")} />
                  <span className="data text-[13px]">{u.username}</span>
                  {isMe && <span className="eyebrow text-[9px]">{t("access.people.you")}</span>}
                  <div className="ml-auto">
                    {/* Your own role is stated, not offered: changing it could lock the panel's settings away. */}
                    {isMe ? (
                      <RoleTag role={u.role} className="text-[12px] text-mute" />
                    ) : (
                      <RoleChoice
                        value={u.role}
                        onChange={(role) => patch.mutate({ id: u.id, role })}
                        label={t("access.people.roleLabel", { username: u.username })}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-mute">
                  <span className="flex items-center gap-2">
                    <Switch
                      checked={u.tinfoilEnabled}
                      onChange={(v) => patch.mutate({ id: u.id, tinfoilEnabled: v })}
                      label={t("access.people.tinfoilLabel", { username: u.username })}
                    />
                    {u.tinfoilEnabled
                      ? u.tinfoilLastUsedAt
                        ? t("access.people.tinfoilSince", { when: ago(u.tinfoilLastUsedAt) })
                        : t("access.people.tinfoilOn")
                      : t("access.people.tinfoilOff")}
                  </span>
                  <span>
                    {u.lastLoginAt ? t("access.people.lastLogin", { when: ago(u.lastLoginAt) }) : t("access.people.neverSignedIn")}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<KeyRound className="size-3.5" />}
                      onClick={() => reset.mutate(u.id)}
                      loading={reset.isPending && reset.variables === u.id}
                    >
                      {t("access.people.newPassword")}
                    </Button>
                    {!isMe && (
                      <button
                        onClick={() => remove.mutate(u.id)}
                        aria-label={t("access.people.removeLabel", { username: u.username })}
                        className="grid size-8 place-items-center rounded-lg text-faint hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("access.people.placeholder")}
          aria-label={t("access.people.newUserLabel")}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="max-w-xs"
        />
        <RoleChoice value={role} onChange={setRole} label={t("access.people.newRoleLabel")} />
        <Button type="submit" icon={<Plus className="size-4" />} loading={create.isPending} disabled={!username.trim()}>
          {t("access.people.create")}
        </Button>
      </form>
    </Section>
  );
}

function ConsolesSection() {
  const { t } = useI18n();
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
      toast(next.requireApproval ? t("access.consoles.toastApprovedOnly") : t("access.consoles.toastAnyone"));
      void qc.invalidateQueries({ queryKey: ["store-settings"] });
    },
    onError: (e) => toast(e.message, "error"),
  });

  const s = settings.data?.settings;
  const list = consoles.data?.consoles ?? [];

  return (
    <Section
      title={t("access.consoles.title")}
      description={t("access.consoles.description")}
      actions={
        s && (
          <label className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-2.5">
            <span className="text-[13px]">{t("access.consoles.approvedOnly")}</span>
            <Switch
              checked={s.requireApproval}
              onChange={(v) => saveSettings.mutate({ ...s, requireApproval: v })}
              label={t("access.consoles.approvedOnly")}
            />
          </label>
        )
      }
    >
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-mute">
          {t("access.consoles.empty")}
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
                    placeholder={t("access.consoles.namePlaceholder")}
                    onBlur={(e) => e.target.value !== (c.label ?? "") && update.mutate({ uid: c.uid, label: e.target.value })}
                    className="w-full rounded-md bg-transparent text-sm font-medium placeholder:font-normal placeholder:text-faint focus:outline-none"
                    aria-label={t("access.consoles.nameLabel")}
                  />
                  <p className="data mt-1 truncate text-[11px] text-mute" title={c.uid}>
                    {c.uid}
                  </p>
                </div>
                <Switch checked={c.allowed} onChange={(v) => update.mutate({ uid: c.uid, allowed: v })} label={t("access.consoles.approved")} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-mute">
                <span>{c.allowed ? t("access.consoles.approved") : t("access.consoles.notApproved")}</span>
                <span>{t("access.consoles.seen", { when: ago(c.lastSeen) })}</span>
                {c.version && <span className="data text-[11px]">Tinfoil {c.version}</span>}
                <span className="data text-[11px]">{t("access.consoles.hits", { count: c.hits })}</span>
                <button onClick={() => remove.mutate(c.uid)} className="ml-auto text-faint hover:text-danger" aria-label={t("access.consoles.forget")}>
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
