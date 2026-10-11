import { Hono } from "hono";
import { z } from "zod";
import { newId } from "../crypto";
import { db, getSetting, setSetting } from "../db";
import { fail, failIssue } from "../http";

interface TagRow {
  id: string;
  name: string;
  hue: number;
  keywords: string;
  created_at: number;
}

// Collections most libraries want. eShop genres don't cover these sub-genres,
// so they match on the title description instead. Seeded once, in English;
// the user renames them freely.
const PRESETS = [
  { name: "Metroidvania", hue: 285, keywords: ["metroidvania", "metroid-vania", "metroid vania", "search action"] },
  { name: "Roguelike", hue: 25, keywords: ["roguelike", "roguelite", "rogue-like", "rogue-lite"] },
  { name: "Soulslike", hue: 355, keywords: ["soulslike", "souls-like"] },
  { name: "Co-op", hue: 160, keywords: ["co-op", "cooperative", "coop"] },
];

export function seedTags() {
  if (getSetting("tagsSeeded", false)) return;
  const insert = db.prepare("INSERT OR IGNORE INTO tags (id, name, hue, keywords, created_at) VALUES (?, ?, ?, ?, ?)");
  PRESETS.forEach((p, i) => insert.run(newId(), p.name, p.hue, JSON.stringify(p.keywords), Date.now() + i));
  setSetting("tagsSeeded", true);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matcher(keywords: string[]) {
  const words = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (!words.length) return null;
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escape).join("|")})($|[^\\p{L}\\p{N}])`, "iu");
}

/** Resolves which library items belong to each tag: keyword match, then manual overrides. */
export function tagMemberships() {
  const tags = db.prepare("SELECT * FROM tags ORDER BY created_at").all() as TagRow[];
  const items = db
    .prepare(
      `SELECT COALESCE(f.base_id, 'file:' || f.id) AS key,
              MAX(t.name) AS name, MAX(t.description) AS description, GROUP_CONCAT(f.name, ' ') AS files
       FROM files f LEFT JOIN titles t ON t.id = f.base_id
       GROUP BY key`,
    )
    .all() as { key: string; name: string | null; description: string | null; files: string }[];
  const overrides = db.prepare("SELECT * FROM tag_items").all() as { tag_id: string; item_key: string; state: string }[];
  const override = new Map(overrides.map((o) => [`${o.tag_id}|${o.item_key}`, o.state]));

  const membership: Record<string, { id: string; auto: boolean }[]> = {};
  const counts: Record<string, number> = {};
  const rules = tags.map((t) => ({ tag: t, re: matcher(JSON.parse(t.keywords) as string[]) }));

  for (const item of items) {
    const text = [item.name, item.description, item.files].filter(Boolean).join("\n");
    for (const { tag, re } of rules) {
      const state = override.get(`${tag.id}|${item.key}`);
      const auto = re ? re.test(text) : false;
      const member = state === "add" || (auto && state !== "remove");
      if (!member) continue;
      (membership[item.key] ??= []).push({ id: tag.id, auto: auto && state !== "add" });
      counts[tag.id] = (counts[tag.id] ?? 0) + 1;
    }
  }

  return {
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      hue: t.hue,
      keywords: JSON.parse(t.keywords) as string[],
      count: counts[t.id] ?? 0,
    })),
    items: membership,
  };
}

const tagSchema = z.object({
  name: z.string().trim().min(1, "errors.collectionNameRequired").max(40, "errors.collectionNameTooLong"),
  hue: z.number().int().min(0).max(359).optional(),
  keywords: z.array(z.string().trim().max(60, "errors.keywordTooLong")).max(30, "errors.tooManyKeywords").default([]),
});

export const tagRoutes = new Hono()
  .get("/", (c) => c.json(tagMemberships()))
  .post("/", async (c) => {
    const parsed = tagSchema.safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    const exists = db.prepare("SELECT 1 FROM tags WHERE name = ? COLLATE NOCASE").get(parsed.data.name);
    if (exists) return fail(c, "errors.collectionExists", 409);
    const count = (db.prepare("SELECT COUNT(*) AS n FROM tags").get() as { n: number }).n;
    db.prepare("INSERT INTO tags (id, name, hue, keywords, created_at) VALUES (?, ?, ?, ?, ?)").run(
      newId(),
      parsed.data.name,
      parsed.data.hue ?? (count * 47 + 200) % 360,
      JSON.stringify(parsed.data.keywords.filter(Boolean)),
      Date.now(),
    );
    return c.json(tagMemberships());
  })
  .patch("/:id", async (c) => {
    const parsed = tagSchema.partial().safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    const { name, hue, keywords } = parsed.data;
    const id = c.req.param("id");
    if (name) db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(name, id);
    if (hue !== undefined) db.prepare("UPDATE tags SET hue = ? WHERE id = ?").run(hue, id);
    if (keywords) db.prepare("UPDATE tags SET keywords = ? WHERE id = ?").run(JSON.stringify(keywords.filter(Boolean)), id);
    return c.json(tagMemberships());
  })
  .delete("/:id", (c) => {
    db.prepare("DELETE FROM tags WHERE id = ?").run(c.req.param("id"));
    return c.json(tagMemberships());
  })
  .put("/:id/items", async (c) => {
    const body = (await c.req.json()) as { key?: string; state?: "add" | "remove" | "auto" };
    if (!body.key || !["add", "remove", "auto"].includes(body.state ?? "")) {
      return fail(c, "errors.invalidData");
    }
    const id = c.req.param("id");
    if (body.state === "auto") {
      db.prepare("DELETE FROM tag_items WHERE tag_id = ? AND item_key = ?").run(id, body.key);
    } else {
      db.prepare(
        `INSERT INTO tag_items (tag_id, item_key, state) VALUES (?, ?, ?)
         ON CONFLICT(tag_id, item_key) DO UPDATE SET state = excluded.state`,
      ).run(id, body.key, body.state);
    }
    return c.json(tagMemberships());
  });
