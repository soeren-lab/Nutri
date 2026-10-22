/**
 * Zugriffsregeln – 1:1-Nachbau der Postgres-RLS-Policies (siehe Lovable-Dump).
 *
 * Jede Regel liefert SQL-Fragmente:
 *  - select/delete: (alias, uid) => Bedingung für bestehende Zeilen
 *  - insert:        (v, uid)     => Bedingung für die neue Zeile, v(col) = SQL-Ausdruck des neuen Werts
 *  - update:        { using, check }
 * Fehlt eine Regel, ist die Aktion verboten.
 */
import { esc } from "./db.js";

const u = (uid) => esc(uid);

// ---- Hilfsfunktionen (Ersatz für die SQL-Funktionen aus Supabase) ----
export const hasRole = (uid, role = "admin") =>
  `EXISTS (SELECT 1 FROM user_roles _ur WHERE _ur.user_id = ${u(uid)} AND _ur.role = ${esc(role)})`;

const sharedWith = (type, idExpr, uid) =>
  `EXISTS (SELECT 1 FROM shared_with_friends _s WHERE _s.content_type = ${esc(type)} AND _s.content_id = ${idExpr} AND _s.friend_user_id = ${u(uid)})`;

const cookbookOwner = (cb, uid) =>
  `EXISTS (SELECT 1 FROM cookbooks _co WHERE _co.id = ${cb} AND _co.user_id = ${u(uid)})`;
const cookbookMember = (cb, uid) =>
  `EXISTS (SELECT 1 FROM cookbook_members _cm WHERE _cm.cookbook_id = ${cb} AND _cm.user_id = ${u(uid)})`;
const canViewCookbook = (cb, uid) => `(${cookbookOwner(cb, uid)} OR ${cookbookMember(cb, uid)})`;

const canViewRecipe = (rid, uid) =>
  `(EXISTS (SELECT 1 FROM recipes _r WHERE _r.id = ${rid} AND (_r.user_id = ${u(uid)} OR _r.is_published = 1))` +
  ` OR ${sharedWith("recipe", rid, uid)}` +
  ` OR EXISTS (SELECT 1 FROM cookbook_recipes _cr WHERE _cr.recipe_id = ${rid} AND ${canViewCookbook("_cr.cookbook_id", uid)}))`;

const ownsRecipe = (rid, uid) =>
  `EXISTS (SELECT 1 FROM recipes _ro WHERE _ro.id = ${rid} AND _ro.user_id = ${u(uid)})`;

export const areFriends = (a, b) =>
  `EXISTS (SELECT 1 FROM friendships _f WHERE _f.user_id_a = LEAST(${a}, ${b}) AND _f.user_id_b = GREATEST(${a}, ${b}))`;

// ---- Regel-Bausteine ----
const own = (col = "user_id") => ({
  select: (a, uid) => `${a}.${col} = ${u(uid)}`,
  insert: (v, uid) => `${v(col)} = ${u(uid)}`,
  update: {
    using: (a, uid) => `${a}.${col} = ${u(uid)}`,
    check: (v, uid) => `${v(col)} = ${u(uid)}`,
  },
  delete: (a, uid) => `${a}.${col} = ${u(uid)}`,
});

const selectOnlyOwn = (col = "user_id") => ({ select: own(col).select });

const adminOnlyWrite = {
  insert: (_v, uid) => hasRole(uid),
  update: { using: (_a, uid) => hasRole(uid), check: (_v, uid) => hasRole(uid) },
  delete: (_a, uid) => hasRole(uid),
};

/** Kinder-Tabellen eines Rezepts: sehen, wer das Rezept sehen darf; schreiben nur Besitzer. */
const recipeChild = () => ({
  select: (a, uid) => canViewRecipe(`${a}.recipe_id`, uid),
  insert: (v, uid) => ownsRecipe(v("recipe_id"), uid),
  update: {
    using: (a, uid) => ownsRecipe(`${a}.recipe_id`, uid),
    check: (v, uid) => ownsRecipe(v("recipe_id"), uid),
  },
  delete: (a, uid) => ownsRecipe(`${a}.recipe_id`, uid),
});

const policies = {
  achievements: own(),
  ai_suggestion_cache: own(),
  body_measurements: own(),
  favorites: own(),
  fridge_items: own(),
  meal_plan_entries: own(),
  quick_entry_templates: own(),
  season_points: own(),
  season_points_log: own(),
  shopping_list_items: own(),
  target_history: own(),
  user_points: own(),
  points_log: own(),
  user_plates: own(),
  user_profile: own(),
  user_seen_patch_notes: {
    select: own().select,
    insert: own().insert,
    delete: own().delete,
  },
  user_seen_seasons: {
    select: own().select,
    insert: own().insert,
    delete: own().delete,
  },
  push_subscriptions: own(),
  photo_scan_log: { select: own().select, insert: own().insert },
  season_history: selectOnlyOwn(),
  user_roles: selectOnlyOwn(),
  user_plans: selectOnlyOwn(),
  user_credits: {
    select: (a, uid) => `(${a}.user_id = ${u(uid)} OR ${hasRole(uid)})`,
  },
  credit_ledger: {
    select: (a, uid) => `(${a}.user_id = ${u(uid)} OR ${hasRole(uid)})`,
  },

  brands: {
    select: (a, uid) => `(${a}.is_published = 1 OR ${a}.user_id = ${u(uid)})`,
    insert: own().insert,
    update: own().update,
    delete: own().delete,
  },
  ingredients_master: {
    select: (a, uid) =>
      `(${a}.is_published = 1 OR ${a}.user_id = ${u(uid)} OR ${sharedWith("ingredient", `${a}.id`, uid)})`,
    insert: own().insert,
    update: own().update,
    delete: own().delete,
  },
  recipes: {
    select: (a, uid) => `(${a}.user_id = ${u(uid)} OR ${canViewRecipe(`${a}.id`, uid)})`,
    insert: own().insert,
    update: own().update,
    delete: own().delete,
  },
  ingredients: recipeChild(),
  steps: recipeChild(),
  recipe_components: recipeChild(),
  component_variants: {
    select: (a, uid) =>
      `EXISTS (SELECT 1 FROM recipe_components _rc WHERE _rc.id = ${a}.component_id AND ${canViewRecipe("_rc.recipe_id", uid)})`,
    insert: (v, uid) =>
      `EXISTS (SELECT 1 FROM recipe_components _rc JOIN recipes _r ON _r.id = _rc.recipe_id WHERE _rc.id = ${v("component_id")} AND _r.user_id = ${u(uid)})`,
    update: {
      using: (a, uid) =>
        `EXISTS (SELECT 1 FROM recipe_components _rc JOIN recipes _r ON _r.id = _rc.recipe_id WHERE _rc.id = ${a}.component_id AND _r.user_id = ${u(uid)})`,
      check: (v, uid) =>
        `EXISTS (SELECT 1 FROM recipe_components _rc JOIN recipes _r ON _r.id = _rc.recipe_id WHERE _rc.id = ${v("component_id")} AND _r.user_id = ${u(uid)})`,
    },
    delete: (a, uid) =>
      `EXISTS (SELECT 1 FROM recipe_components _rc JOIN recipes _r ON _r.id = _rc.recipe_id WHERE _rc.id = ${a}.component_id AND _r.user_id = ${u(uid)})`,
  },

  cookbooks: {
    select: (a, uid) => `(${a}.user_id = ${u(uid)} OR ${cookbookMember(`${a}.id`, uid)})`,
    insert: own().insert,
    update: own().update,
    delete: own().delete,
  },
  cookbook_members: {
    select: (a, uid) => `(${a}.user_id = ${u(uid)} OR ${cookbookOwner(`${a}.cookbook_id`, uid)})`,
    insert: (v, uid) => cookbookOwner(v("cookbook_id"), uid),
    delete: (a, uid) => `(${a}.user_id = ${u(uid)} OR ${cookbookOwner(`${a}.cookbook_id`, uid)})`,
  },
  cookbook_recipes: {
    select: (a, uid) => canViewCookbook(`${a}.cookbook_id`, uid),
    insert: (v, uid) => cookbookOwner(v("cookbook_id"), uid),
    update: {
      using: (a, uid) => cookbookOwner(`${a}.cookbook_id`, uid),
      check: (v, uid) => cookbookOwner(v("cookbook_id"), uid),
    },
    delete: (a, uid) => cookbookOwner(`${a}.cookbook_id`, uid),
  },

  friend_requests: {
    select: (a, uid) => `(${u(uid)} = ${a}.sender_id OR ${u(uid)} = ${a}.receiver_id)`,
    insert: (v, uid) => `(${u(uid)} = ${v("sender_id")} AND ${v("sender_id")} <> ${v("receiver_id")})`,
    update: {
      using: (a, uid) => `(${u(uid)} = ${a}.receiver_id OR ${u(uid)} = ${a}.sender_id)`,
      check: (v, uid) => `(${u(uid)} = ${v("receiver_id")} OR ${u(uid)} = ${v("sender_id")})`,
    },
    delete: (a, uid) => `(${u(uid)} = ${a}.sender_id OR ${u(uid)} = ${a}.receiver_id)`,
  },
  friendships: {
    select: (a, uid) => `(${u(uid)} = ${a}.user_id_a OR ${u(uid)} = ${a}.user_id_b)`,
    delete: (a, uid) => `(${u(uid)} = ${a}.user_id_a OR ${u(uid)} = ${a}.user_id_b)`,
  },
  shared_with_friends: {
    select: (a, uid) => `(${u(uid)} = ${a}.owner_user_id OR ${u(uid)} = ${a}.friend_user_id)`,
    insert: (v, uid) =>
      `(${u(uid)} = ${v("owner_user_id")} AND ${areFriends(v("owner_user_id"), v("friend_user_id"))})`,
    delete: (a, uid) => `${u(uid)} = ${a}.owner_user_id`,
  },

  patch_notes: {
    select: () => "1=1",
    insert: (v, uid) => `(${hasRole(uid)} AND ${v("published_by")} = ${u(uid)})`,
    update: { using: adminOnlyWrite.update.using, check: () => "1=1" },
    delete: adminOnlyWrite.delete,
  },
  patch_note_sections: { select: () => "1=1", ...adminOnlyWrite },
  seasons: { select: () => "1=1" },
};

export function getPolicy(table) {
  return policies[table] || {};
}

/** Storage: Lesen/Schreiben pro Bucket (Pfad beginnt mit der User-ID). */
export function storageCanWrite(bucket, path, uid) {
  return path.split("/")[0] === uid;
}

export const storageReadAnyAuthed = new Set(["avatars", "recipe-images"]);
