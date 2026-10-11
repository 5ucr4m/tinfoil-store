import { Fragment, cloneElement, isValidElement, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import en from "./locales/en";
import es from "./locales/es";
import ptBR from "./locales/pt-BR";

/**
 * Panel translations. English is the source of truth: every other locale is typed
 * against it, so a missing key fails `tsc`. Strings use `{name}` placeholders; plural
 * entries are `{ one, other }` objects picked with Intl.PluralRules from `count`.
 */

export const LOCALES = [
  { code: "en", short: "EN", name: "English" },
  { code: "pt-BR", short: "PT", name: "Português" },
  { code: "es", short: "ES", name: "Español" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";

type Plural = { one: string; other: string };
/** Same shape as the English dictionary, with any string allowed in the leaves. */
export type Messages<T = typeof en> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends Plural ? Plural : Messages<T[K]>;
};

type Leaf<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Leaf<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaf<typeof en>;
export type Params = Record<string, string | number>;

const dictionaries: Record<Locale, Messages> = { en, "pt-BR": ptBR, es };

const STORAGE_KEY = "cartucho-locale";
const listeners = new Set<() => void>();

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LOCALES.some((l) => l.code === saved)) return saved as Locale;
  } catch {}
  return DEFAULT_LOCALE;
}

let current = readLocale();
document.documentElement.lang = current;

export const getLocale = () => current;

export function setLocale(next: Locale) {
  current = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

function lookup(locale: Locale, key: string): string | Plural | undefined {
  let node: unknown = dictionaries[locale];
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  return node as string | Plural | undefined;
}

function interpolate(text: string, params?: Params) {
  return params ? text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m)) : text;
}

/** Translates outside React (upload engine, formatters). Falls back to English, then to the key. */
export function translate(key: MessageKey, params?: Params, locale: Locale = current): string {
  const entry = lookup(locale, key) ?? lookup(DEFAULT_LOCALE, key);
  if (entry === undefined) return key;
  if (typeof entry === "string") return interpolate(entry, params);
  const count = Number(params?.count ?? 0);
  const form = new Intl.PluralRules(locale).select(count) === "one" ? entry.one : entry.other;
  return interpolate(form, params);
}

export function useI18n() {
  const locale = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return { locale, setLocale, t: (key: MessageKey, params?: Params) => translate(key, params, locale) };
}

/**
 * Translation with inline markup: tags in the message (`<b>…</b>`, `<link>…</link>`)
 * are replaced by the matching element from `components`, keeping its props.
 */
export function Trans({
  k,
  params,
  components = {},
}: {
  k: MessageKey;
  params?: Params;
  components?: Record<string, ReactElement>;
}) {
  const { t } = useI18n();
  const text = t(k, params);
  const parts: ReactNode[] = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const [, tag, inner] = match;
    const el = components[tag];
    parts.push(
      isValidElement(el) ? (
        cloneElement(el as ReactElement<{ children?: ReactNode }>, { key: parts.length }, inner)
      ) : tag === "b" ? (
        <b key={parts.length}>{inner}</b>
      ) : (
        <Fragment key={parts.length}>{inner}</Fragment>
      ),
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
