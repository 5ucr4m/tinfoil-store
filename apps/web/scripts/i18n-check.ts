/**
 * Translation checks for the panel. Run with `bun run i18n:check` (from apps/web).
 *
 *  1. Every locale has exactly the English keys (no missing, no extra), including plural forms.
 *  2. Placeholders ({name}) and inline tags (<b>…</b>) match the English message.
 *  3. Translated text identical to English is listed for review (often a forgotten translation).
 *  4. English keys never referenced in the source are listed (dead strings).
 *  5. Hard-coded user-facing text in .tsx files: JSX text and string literals in visible props.
 *
 * Exits non-zero on 1, 2 and 5. 3 and 4 are warnings.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import en from "../src/i18n/locales/en";
import es from "../src/i18n/locales/es";
import ptBR from "../src/i18n/locales/pt-BR";

type Tree = { [k: string]: string | Tree };
const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "src");

/** Values that are legitimately the same across languages (brands, codes, cognates). */
const SAME_OK = new Set([
  "RPG", "Arcade", "Party", "Fitness", "DLC", "Tinfoil", "Google Drive", "MinIO", "S3", "OAuth",
  "Client ID", "Client Secret", "Metroidvania", "Roguelike", "Soulslike", "Cartucho", "v0", "Total",
  "Multiplayer", "Path", "Host", "Port", "Protocol", "Username", "Title", "URL", "ok", "OK",
  "Bucket", "Endpoint", "backup", "{count} dlc", "Error {status}.", "Error", "A–Z",
]);
/** Example values (URLs, host names) are the same in every language. */
const looksLikeExample = (v: string) => /^(https?:\/\/|[\w.-]+\.\w+(:\d+)?$)/.test(v);

function flatten(tree: Tree, prefix = "", out = new Map<string, string>()) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else flatten(v as Tree, key, out);
  }
  return out;
}

// Placeholders and paired inline tags (<b>…</b>). A lone "<account>" in an example URL is plain text.
const tokens = (s: string) =>
  [...[...s.matchAll(/\{(\w+)\}/g)].map((m) => m[0]), ...[...s.matchAll(/<(\w+)>[^]*?<\/\1>/g)].map((m) => `<${m[1]}>`)]
    .sort()
    .join(" ");

const errors: string[] = [];
const warnings: string[] = [];

const base = flatten(en as unknown as Tree);
for (const [name, dict] of [["pt-BR", ptBR], ["es", es]] as const) {
  const other = flatten(dict as unknown as Tree);
  for (const key of base.keys()) if (!other.has(key)) errors.push(`[${name}] missing key: ${key}`);
  for (const key of other.keys()) if (!base.has(key)) errors.push(`[${name}] extra key: ${key}`);
  for (const [key, value] of other) {
    const source = base.get(key);
    if (source === undefined) continue;
    if (tokens(source) !== tokens(value)) {
      errors.push(`[${name}] placeholders differ in ${key}: "${tokens(source)}" vs "${tokens(value)}"`);
    }
    if (value === source && !SAME_OK.has(value) && !looksLikeExample(value) && /[a-z]{3,}/i.test(value) && !/^\{?\w+\}?$/.test(value)) {
      warnings.push(`[${name}] same as English: ${key} = "${value}"`);
    }
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return p.includes("/i18n") ? [] : walk(p);
    return /\.(tsx?|ts)$/.test(f) ? [p] : [];
  });
}

const files = walk(SRC);
const sources = files.map((f) => readFileSync(f, "utf8")).join("\n");

// 4. Unused keys: a key counts as used when its full path appears, or when a dynamic
// prefix like t(`common.kind.${kind}`) covers it.
const dynamicPrefixes = [...sources.matchAll(/[`"']([a-zA-Z]+(?:\.[a-zA-Z]+)*)\.\$\{/g)].map((m) => `${m[1]}.`);
for (const key of base.keys()) {
  const stem = key.replace(/\.(one|other)$/, "");
  if (!sources.includes(`"${stem}"`) && !sources.includes(`'${stem}'`) && !sources.includes(`\`${stem}\``) && !dynamicPrefixes.some((p) => stem.startsWith(p))) {
    warnings.push(`unused key: ${stem}`);
  }
}

// 5. Hard-coded text. JSX text between tags, and literals in props people read.
const VISIBLE_PROPS = /\b(aria-label|title|placeholder|alt|label|hint|description|meta|message)=\s*"([^"]*[A-Za-zÀ-ú]{2,}[^"]*)"/g;
const JSX_TEXT = />\s*([A-Za-zÀ-ú][^<>{}\n]*[A-Za-zÀ-ú.!?:])\s*</g;
const ALLOWED_TEXT = /^(Cartucho|Tinfoil|Google Drive|YouTube|DLC|v0|NSP|NSZ|XCI|ID|OK|EN|PT|ES)$/;
for (const file of files.filter((f) => f.endsWith(".tsx"))) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const where = (index: number) => `${relative(ROOT, file)}:${text.slice(0, index).split("\n").length}`;
  for (const m of text.matchAll(VISIBLE_PROPS)) {
    if (!ALLOWED_TEXT.test(m[2])) errors.push(`hard-coded ${m[1]}="${m[2]}" at ${where(m.index!)}`);
  }
  for (const m of text.matchAll(JSX_TEXT)) {
    const value = m[1].trim();
    const line = lines[text.slice(0, m.index!).split("\n").length - 1] ?? "";
    // Skip TypeScript generics/comparisons that look like tags, and allowed brand words.
    if (ALLOWED_TEXT.test(value) || /=>|&&|\|\||<\w+>\(/.test(line) || /^[\w.]+$/.test(value) && !/\s/.test(value) && value.length < 4) continue;
    errors.push(`hard-coded text "${value}" at ${where(m.index!)}`);
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\n${base.size} English keys · ${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
