import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { Wordmark } from "../components/Shell";
import { Trans, getLocale, useI18n, type MessageKey } from "../i18n";

export type LegalDoc = "privacy" | "terms";

/** Bump when the text of either document changes. */
const UPDATED = new Date(2026, 9, 25);
const CONTACT_EMAIL = "contato@5ucr4m.com";

const SECTIONS = {
  privacy: ["about", "data", "google", "use", "sharing", "storage", "revoke", "contact"],
  terms: ["about", "access", "content", "google", "warranty", "liability", "changes"],
} as const;

const linkClass = "font-medium text-signal underline underline-offset-2";
const external = (href: string) => <a href={href} target="_blank" rel="noreferrer" className={linkClass} />;

const LINKS = {
  policy: external("https://developers.google.com/terms/api-services-user-data-policy"),
  google: external("https://myaccount.google.com/connections"),
  privacy: <Link to="/privacy" className={linkClass} />,
  email: <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass} />,
};

/**
 * Privacy policy and terms of use. Public: Google's OAuth consent screen links here,
 * so they render without signing in.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t } = useI18n();
  const other: LegalDoc = doc === "privacy" ? "terms" : "privacy";
  const date = UPDATED.toLocaleDateString(getLocale(), { dateStyle: "long" });

  return (
    <div className="board min-h-dvh px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label={t("legal.back")}>
            <Wordmark />
          </Link>
          <LanguageSwitch variant="compact" />
        </header>

        <article className="mt-8 rounded-[18px] bg-raised p-6 ring-1 ring-line sm:p-10">
          <h1 className="display-narrow text-[32px] leading-tight">{t(`legal.${doc}.title`)}</h1>
          <p className="mt-2 text-sm text-mute">{t("legal.updated", { date })}</p>

          <p className="mt-6 flex gap-3 rounded-xl bg-signal-soft p-4 text-[15px] leading-relaxed text-ink">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-signal" aria-hidden />
            <span>{t("legal.notice")}</span>
          </p>

          {SECTIONS[doc].map((id) => (
            <section key={id} className="mt-8">
              <h2 className="text-lg font-semibold">{t(`legal.${doc}.${id}.title` as MessageKey)}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-mute">
                <Trans k={`legal.${doc}.${id}.body` as MessageKey} params={{ email: CONTACT_EMAIL }} components={LINKS} />
              </p>
              {doc === "privacy" && id === "google" && (
                <p className="mt-3 border-l-2 border-signal pl-4 text-[15px] leading-relaxed text-ink">
                  <Trans k="legal.privacy.limitedUse" components={LINKS} />
                </p>
              )}
            </section>
          ))}
        </article>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-mute">
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            {t("legal.back")}
          </Link>
          <Link to={`/${other}`} className="hover:text-ink">
            {t(`legal.links.${other}`)}
          </Link>
        </footer>
      </div>
    </div>
  );
}

/** Footer links to both documents, for screens that must point at them (sign-in). */
export function LegalLinks({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <nav className={className}>
      <Link to="/privacy" className="hover:text-ink hover:underline">
        {t("legal.links.privacy")}
      </Link>
      <span aria-hidden>·</span>
      <Link to="/terms" className="hover:text-ink hover:underline">
        {t("legal.links.terms")}
      </Link>
    </nav>
  );
}
