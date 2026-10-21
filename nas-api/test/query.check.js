import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSelect, filterSql } from "../src/query.js";
import { toDbValue, fromDbValue } from "../src/db.js";
import { getPolicy } from "../src/policies.js";
import { seasonRankKey } from "../src/rpc.js";

test("select-Parser: Spalten, Embeds, Aliase, Hints, count", () => {
  const p = parseSelect(
    "*, ingredients(*, master:ingredients_master(*)), components:recipe_components!recipe_components_recipe_id_fkey(*, variants:component_variants(*)), cookbook_recipes(count)",
  );
  assert.equal(p.star, true);
  assert.deepEqual(p.embeds.map((e) => e.alias), ["ingredients", "components", "cookbook_recipes"]);
  assert.equal(p.embeds[0].children.embeds[0].alias, "master");
  assert.equal(p.embeds[1].hint, "recipe_components_recipe_id_fkey");
  assert.equal(p.embeds[1].children.embeds[0].table, "component_variants");
  assert.equal(p.embeds[2].count, true);
});

test("Filter: eq/in/is/or/not", () => {
  assert.equal(filterSql("recipes", { op: "eq", col: "user_id", val: "abc" }), "t.`user_id` = 'abc'");
  assert.equal(filterSql("recipes", { op: "eq", col: "image_url", val: null }), "t.`image_url` IS NULL");
  assert.equal(filterSql("recipes", { op: "in", col: "id", val: ["a", "b"] }), "t.`id` IN ('a','b')");
  assert.equal(filterSql("recipes", { op: "is", col: "is_published", val: true }), "t.`is_published` = 1");
  assert.equal(
    filterSql("recipes", { op: "or", val: "title.ilike.%kuchen%,category.eq.Dessert" }),
    "(t.`title` LIKE '%kuchen%' OR t.`category` = 'Dessert')",
  );
  assert.match(filterSql("recipes", { op: "not", col: "id", operator: "eq", val: "x" }), /^NOT \(/);
  assert.throws(() => filterSql("recipes", { op: "eq", col: "gibts_nicht", val: 1 }));
});

test("Werte-Umwandlung: bool, Array, Zeitstempel", () => {
  assert.equal(toDbValue("bool", true), 1);
  assert.equal(toDbValue("arr", ["a", "b"]), '["a","b"]');
  assert.equal(toDbValue("ts", "2026-10-21T17:44:00.123+02:00"), "2026-10-21 15:44:00.123");
  assert.equal(fromDbValue("bool", 1), true);
  assert.deepEqual(fromDbValue("arr", '["a"]'), ["a"]);
  assert.equal(fromDbValue("ts", "2026-10-21 15:44:00.123"), "2026-10-21T15:44:00.123+00:00");
});

test("Zugriffsregeln: eigene Zeilen, fehlende Regeln verbieten", () => {
  assert.equal(getPolicy("meal_plan_entries").select("t", "u1"), "t.user_id = 'u1'");
  assert.equal(getPolicy("user_credits").insert, undefined);
  assert.equal(getPolicy("friendships").insert, undefined);
  assert.match(getPolicy("recipes").select("t", "u1"), /is_published/);
});

test("Rang-Schlüssel", () => {
  assert.equal(seasonRankKey(0), "bronze_1");
  assert.equal(seasonRankKey(100), "bronze_2");
  assert.equal(seasonRankKey(33000), "unreal_2");
});

import { usageCostUsd } from "../src/photoScan.js";
test("Foto-Scan: Kosten wie in credits.ts (inkl. 20 % Aufschlag)", () => {
  const cost = usageCostUsd("claude-sonnet-5-5", { input_tokens: 6000, output_tokens: 800 });
  assert.ok(Math.abs(cost - 0.024) < 1e-9);
  assert.equal(usageCostUsd("unbekannt", { input_tokens: 1_000_000, output_tokens: 0 }), 12);
});
