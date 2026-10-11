import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Pins } from "../components/Cartridge";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { Wordmark } from "../components/Shell";
import { Button, Field, Input } from "../components/ui";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

export function AuthPage({ setup, onDone }: { setup: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (setup && password !== confirm) return setError(t("auth.mismatch"));
    setLoading(true);
    try {
      await api(setup ? "/auth/setup" : "/auth/login", { method: "POST", json: { password } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setLoading(false);
    }
  };

  // Pins fill as the password grows: a small nod to the transfer meter.
  const strength = Math.min(password.length / 14, 1);

  return (
    <div className="board relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--paper)_70%)]" />
      <LanguageSwitch variant="compact" className="absolute top-4 right-4 z-10" />
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 20 }}
        className="relative w-full max-w-[380px]"
      >
        <div
          className="rounded-[22px] bg-shell p-3 pt-0 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.55)] ring-1 ring-shell-edge"
          style={{ clipPath: "polygon(0 0, calc(100% - 30px) 0, 100% 30px, 100% 100%, 0 100%)" }}
        >
          <div className="flex h-9 items-center pl-1">
            <Pins progress={strength} count={12} size="md" />
          </div>
          <form onSubmit={submit} className="rounded-[14px] bg-raised p-6 sm:p-7">
            <Wordmark />
            <h1 className="display-narrow mt-8 text-[28px]">{setup ? t("auth.setupTitle") : t("auth.loginTitle")}</h1>
            <p className="mt-2 text-sm text-mute">
              {setup ? t("auth.setupBody") : t("auth.loginBody")}
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <Field label={t("auth.password")}>
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoFocus
                    autoComplete={setup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={setup ? 8 : undefined}
                    required
                  />
                )}
              </Field>
              {setup && (
                <Field label={t("auth.repeat")} hint={t("auth.repeatHint")}>
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  )}
                </Field>
              )}
              {error && (
                <motion.p initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-danger" role="alert">
                  {error}
                </motion.p>
              )}
              <Button type="submit" variant="primary" loading={loading} className="mt-1 h-11">
                {setup ? t("auth.submitSetup") : t("auth.submitLogin")}
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </div>
          </form>
          <div className="flex justify-center gap-1.5 py-2.5" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="h-1 w-6 rounded-full bg-shell-edge" />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
