import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gamepad2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { RoleMark } from "../components/RoleMark";
import { Button, Field, Input, PageHeader, Section, useToast } from "../components/ui";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function AccountPage() {
  const { t } = useI18n();
  const { user, isAdmin } = useSession();

  return (
    <>
      <PageHeader title={t("account.title")} meta={t("account.meta")} />

      {/* The role, stated as what it lets you do rather than as a label repeated twice. */}
      <div className="flex items-start gap-4 rounded-2xl border border-line bg-raised p-5 shadow-card">
        <RoleMark role={user.role} className={isAdmin ? "mt-0.5 size-6 text-signal" : "mt-0.5 size-6 text-mute"} />
        <div className="min-w-0">
          <p className="display-narrow text-xl">{user.username}</p>
          <p className="mt-1.5 max-w-xl text-sm text-mute">{isAdmin ? t("account.canAdmin") : t("account.canRead")}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <PasswordSection tinfoilEnabled={user.tinfoilEnabled} />
        <TinfoilSection enabled={user.tinfoilEnabled} />
      </div>
    </>
  );
}

function PasswordSection({ tinfoilEnabled }: { tinfoilEnabled: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");

  const change = useMutation({
    mutationFn: () => api("/account/password", { method: "POST", json: { current, password } }),
    onSuccess: () => {
      toast(t("account.password.changed"));
      setCurrent("");
      setPassword("");
      // The store caches credentials for Tinfoil; the panel should read the account again too.
      void qc.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <Section
      title={t("account.password.title")}
      description={tinfoilEnabled ? t("account.password.tinfoilNote") : t("account.password.description")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
        className="grid max-w-2xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field label={t("account.password.current")}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label={t("account.password.next")}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" loading={change.isPending}>
          {t("account.password.submit")}
        </Button>
      </form>
    </Section>
  );
}

function TinfoilSection({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  return (
    <Section title={t("account.tinfoil.title")}>
      <div className="flex flex-wrap items-center gap-3">
        <Gamepad2 className={enabled ? "size-4 text-signal" : "size-4 text-faint"} />
        <p className="text-sm">{enabled ? t("account.tinfoil.on") : t("account.tinfoil.off")}</p>
        <Link to="/connect" className="text-[13px] font-medium text-signal hover:underline">
          {t("account.tinfoil.manage")}
        </Link>
      </div>
    </Section>
  );
}
