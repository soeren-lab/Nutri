/** Ersatz für die Postgres-Funktionen (supabase.rpc). `uid` ist der eingeloggte User. */
import { query, esc, tx } from "./db.js";
import { ApiError } from "./query.js";
import { hasRole } from "./policies.js";
import { randomUUID } from "node:crypto";

const iso = (v) => (v ? String(v).replace(" ", "T") + "+00:00" : null);
const fixTs = (rows, ...keys) =>
  rows.map((r) => {
    for (const k of keys) if (r[k] != null) r[k] = iso(r[k]);
    return r;
  });
const bool = (v) => Boolean(Number(v));

const RANKS = [
  [33000, "unreal_2"], [30000, "unreal_1"], [25500, "champion_3"], [22000, "champion_2"],
  [18500, "champion_1"], [15400, "elite_3"], [13000, "elite_2"], [11000, "elite_1"],
  [9200, "diamond_3"], [7600, "diamond_2"], [6200, "diamond_1"], [5000, "platinum_3"],
  [4000, "platinum_2"], [3200, "platinum_1"], [2500, "gold_3"], [1900, "gold_2"],
  [1400, "gold_1"], [1000, "silver_3"], [700, "silver_2"], [450, "silver_1"],
  [250, "bronze_3"], [100, "bronze_2"],
];
export const seasonRankKey = (p) => (RANKS.find(([min]) => p >= min) || [0, "bronze_1"])[1];

const POINTS = "(COALESCE(up.total_points, 0) + COALESCE(up.bonus_points, 0))";

/** Eingeloggte Person + Freunde (wie CTE `people`). */
const peopleSql = (uid) => `
  SELECT ${esc(uid)} AS uid, 1 AS self
  UNION ALL
  SELECT CASE WHEN f.user_id_a = ${esc(uid)} THEN f.user_id_b ELSE f.user_id_a END, 0
  FROM friendships f WHERE f.user_id_a = ${esc(uid)} OR f.user_id_b = ${esc(uid)}`;

const handlers = {
  async has_role(uid, { _user_id, _role }) {
    const [r] = await query(`SELECT ${hasRole(_user_id, _role)} AS ok`);
    return bool(r.ok);
  },

  async is_username_available(uid, { _username }) {
    const [r] = await query(
      `SELECT COUNT(*) AS c FROM user_profile WHERE username IS NOT NULL AND LOWER(username) = LOWER(TRIM(${esc(_username)})) AND user_id <> ${esc(uid)}`,
    );
    return Number(r.c) === 0;
  },

  async get_usernames(uid, { _user_ids }) {
    if (!_user_ids?.length) return [];
    return query(
      `SELECT user_id, username FROM user_profile WHERE username IS NOT NULL AND user_id IN (${_user_ids.map(esc).join(",")})`,
    );
  },

  async get_user_avatars(uid, { _user_ids }) {
    if (!_user_ids?.length) return [];
    return query(
      `SELECT user_id, username, avatar_url FROM user_profile WHERE username IS NOT NULL AND user_id IN (${_user_ids.map(esc).join(",")})`,
    );
  },

  async search_users(uid, { _query }) {
    const q = String(_query || "").trim();
    if (q.length < 2) return [];
    return query(
      `SELECT p.user_id, p.username, p.avatar_url, ${POINTS} AS total_points
       FROM user_profile p LEFT JOIN user_points up ON up.user_id = p.user_id
       WHERE p.user_id <> ${esc(uid)} AND p.username IS NOT NULL AND p.username LIKE ${esc("%" + q.replace(/[%_]/g, "\\$&") + "%")}
       ORDER BY p.username LIMIT 25`,
    );
  },

  async get_public_profile(uid, { _username }) {
    return query(
      `SELECT p.user_id, p.username, p.avatar_url, ${POINTS} AS total_points, COALESCE(up.current_streak_days, 0) AS current_streak_days
       FROM user_profile p LEFT JOIN user_points up ON up.user_id = p.user_id
       WHERE p.username IS NOT NULL AND LOWER(p.username) = LOWER(TRIM(${esc(_username)})) LIMIT 1`,
    );
  },

  async get_my_friends(uid) {
    const rows = await query(
      `SELECT p.user_id, p.username, p.avatar_url, ${POINTS} AS total_points,
              COALESCE(up.current_streak_days, 0) AS current_streak_days, f.created_at AS friends_since
       FROM friendships f
       JOIN user_profile p ON p.user_id = CASE WHEN f.user_id_a = ${esc(uid)} THEN f.user_id_b ELSE f.user_id_a END
       LEFT JOIN user_points up ON up.user_id = p.user_id
       WHERE f.user_id_a = ${esc(uid)} OR f.user_id_b = ${esc(uid)}
       ORDER BY p.username`,
    );
    return fixTs(rows, "friends_since");
  },

  async get_friend_requests(uid, { _direction }) {
    const incoming = _direction === "incoming";
    const rows = await query(
      `SELECT fr.id AS request_id, p.user_id, p.username, p.avatar_url, ${POINTS} AS total_points, fr.created_at
       FROM friend_requests fr
       JOIN user_profile p ON p.user_id = ${incoming ? "fr.sender_id" : "fr.receiver_id"}
       LEFT JOIN user_points up ON up.user_id = p.user_id
       WHERE fr.status = 'pending' AND ${incoming ? "fr.receiver_id" : "fr.sender_id"} = ${esc(uid)}
       ORDER BY fr.created_at DESC`,
    );
    return fixTs(rows, "created_at");
  },

  async accept_friend_request(uid, { _request_id }) {
    await tx(async (c) => {
      const [[req]] = await c.query(
        `SELECT sender_id, receiver_id FROM friend_requests WHERE id = ${esc(_request_id)} AND receiver_id = ${esc(uid)} AND status = 'pending'`,
      );
      if (!req) throw new ApiError("Anfrage nicht gefunden", "P0001");
      await c.query(
        `UPDATE friend_requests SET status = 'accepted', responded_at = ${esc(new Date().toISOString().replace("T", " ").replace("Z", ""))} WHERE id = ${esc(_request_id)}`,
      );
      const [a, b] = [req.sender_id, req.receiver_id].sort();
      await c.query(
        `INSERT IGNORE INTO friendships (id, user_id_a, user_id_b, created_at) VALUES (${esc(randomUUID())}, ${esc(a)}, ${esc(b)}, ${esc(new Date().toISOString().replace("T", " ").replace("Z", ""))})`,
      );
    });
    return null;
  },

  async end_friendship(uid, { _other_user_id }) {
    const [a, b] = [uid, _other_user_id].sort();
    await tx(async (c) => {
      await c.query(`DELETE FROM friendships WHERE user_id_a = ${esc(a)} AND user_id_b = ${esc(b)}`);
      await c.query(
        `DELETE FROM shared_with_friends WHERE (owner_user_id = ${esc(uid)} AND friend_user_id = ${esc(_other_user_id)}) OR (owner_user_id = ${esc(_other_user_id)} AND friend_user_id = ${esc(uid)})`,
      );
      await c.query(
        `DELETE FROM friend_requests WHERE (sender_id = ${esc(uid)} AND receiver_id = ${esc(_other_user_id)}) OR (sender_id = ${esc(_other_user_id)} AND receiver_id = ${esc(uid)})`,
      );
    });
    return null;
  },

  async get_friend_comparison(uid) {
    const rows = await query(
      `SELECT p.uid AS user_id, pr.username, pr.avatar_url, ${POINTS} AS total_points,
              COALESCE(up.current_streak_days, 0) AS current_streak_days,
              ROUND(COALESCE(w.sum_points, 0) / 7, 1) AS week_avg_points,
              COALESCE(w.days, 0) AS week_days, COALESCE(ach.cnt, 0) AS achievement_count, p.self AS is_self
       FROM (${peopleSql(uid)}) p
       LEFT JOIN user_profile pr ON pr.user_id = p.uid
       LEFT JOIN user_points up ON up.user_id = p.uid
       LEFT JOIN (SELECT user_id, SUM(points_earned) AS sum_points, COUNT(*) AS days FROM points_log WHERE date >= CURRENT_DATE - INTERVAL 6 DAY GROUP BY user_id) w ON w.user_id = p.uid
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM achievements GROUP BY user_id) ach ON ach.user_id = p.uid
       WHERE p.self = 1 OR pr.username IS NOT NULL`,
    );
    return rows.map((r) => ({ ...r, is_self: bool(r.is_self) }));
  },

  async get_friend_season_comparison(uid) {
    const rows = await query(
      `SELECT p.uid AS user_id, pr.username, pr.avatar_url, ${POINTS} AS total_points,
              COALESCE(up.current_streak_days, 0) AS current_streak_days, p.self AS is_self
       FROM (${peopleSql(uid)}) p
       LEFT JOIN user_profile pr ON pr.user_id = p.uid
       LEFT JOIN user_points up ON up.user_id = p.uid
       WHERE p.self = 1 OR pr.username IS NOT NULL`,
    );
    return rows.map((r) => ({ ...r, is_self: bool(r.is_self) }));
  },

  async get_friend_season_history(uid, { _season_id }) {
    const rows = await query(
      `SELECT p.uid AS user_id, pr.username, pr.avatar_url, COALESCE(sh.final_points, 0) AS final_points,
              COALESCE(sh.final_rank, 'bronze_1') AS final_rank, p.self AS is_self
       FROM (${peopleSql(uid)}) p
       LEFT JOIN user_profile pr ON pr.user_id = p.uid
       LEFT JOIN season_history sh ON sh.user_id = p.uid AND sh.season_id = ${esc(_season_id)}
       WHERE (p.self = 1 OR pr.username IS NOT NULL) AND sh.id IS NOT NULL`,
    );
    return rows.map((r) => ({ ...r, is_self: bool(r.is_self) }));
  },

  async get_my_recipe_import_count(uid) {
    const [r] = await query(
      `SELECT COALESCE(MAX(cnt), 0) AS m FROM (
         SELECT COUNT(*) AS cnt FROM recipes mine JOIN recipes copies ON copies.source_recipe_id = mine.id
         WHERE mine.user_id = ${esc(uid)} AND mine.is_published = 1 AND copies.user_id <> ${esc(uid)} GROUP BY mine.id) x`,
    );
    return Number(r.m);
  },

  async get_other_push_tokens(uid, { _exclude_user_id }) {
    const [adm] = await query(`SELECT ${hasRole(uid)} AS ok`);
    if (!bool(adm.ok)) return [];
    return query(`SELECT fcm_token FROM push_subscriptions WHERE user_id <> ${esc(_exclude_user_id)}`);
  },

  async recipe_link_creates_cycle(uid, { _parent_recipe_id, _target_recipe_id }) {
    // Alle von _target erreichbaren Rezepte durchlaufen; trifft man _parent, gäbe es einen Zyklus.
    const seen = new Set();
    let frontier = [_target_recipe_id];
    while (frontier.length) {
      if (frontier.includes(_parent_recipe_id)) return true;
      frontier.forEach((x) => seen.add(x));
      const rows = await query(
        `SELECT DISTINCT linked_recipe_id AS id FROM recipe_components WHERE linked_recipe_id IS NOT NULL AND recipe_id IN (${frontier.map(esc).join(",")})`,
      );
      frontier = rows.map((r) => r.id).filter((id) => !seen.has(id));
    }
    return false;
  },

  async ensure_current_season(uid) {
    return tx(async (c) => {
      const q = async (sql) => (await c.query(sql))[0];
      const nowTs = () => new Date().toISOString().replace("T", " ").replace("Z", "");
      const day = (offset = 0, base = null) => {
        const d = base ? new Date(base + "T00:00:00Z") : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + offset);
        return d.toISOString().slice(0, 10);
      };
      const nextNumber = async () => Number((await q(`SELECT COALESCE(MAX(season_number), 0) + 1 AS n FROM seasons`))[0].n);
      const newSeason = async (start, end) => {
        const n = await nextNumber();
        const id = randomUUID();
        await q(
          `INSERT INTO seasons (id, name, start_date, end_date, is_active, season_number) VALUES (${esc(id)}, ${esc("Season " + n)}, ${esc(start)}, ${esc(end)}, 1, ${n})`,
        );
        return (await q(`SELECT * FROM seasons WHERE id = ${esc(id)}`))[0];
      };

      let s = (await q(`SELECT * FROM seasons WHERE is_active = 1 LIMIT 1`))[0];
      if (!s) s = await newSeason(day(0), day(70));

      let guard = 0;
      while (s.end_date < day(0) && guard < 50) {
        guard++;
        const users = await q(`SELECT user_id, total_points, bonus_points FROM user_points`);
        for (const up of users) {
          const pts = Number(up.total_points) + Number(up.bonus_points);
          const ahead = await q(
            `SELECT COUNT(*) AS c FROM user_points other JOIN friendships f
               ON f.user_id_a = LEAST(${esc(up.user_id)}, other.user_id) AND f.user_id_b = GREATEST(${esc(up.user_id)}, other.user_id)
             WHERE other.user_id <> ${esc(up.user_id)} AND (other.total_points + other.bonus_points) > ${pts}`,
          );
          await q(
            `INSERT IGNORE INTO season_history (id, user_id, season_id, final_points, final_rank, final_placement_among_friends, created_at)
             VALUES (${esc(randomUUID())}, ${esc(up.user_id)}, ${esc(s.id)}, ${pts}, ${esc(seasonRankKey(pts))}, ${1 + Number(ahead[0].c)}, ${esc(nowTs())})`,
          );
        }
        await q(`UPDATE seasons SET is_active = 0 WHERE id = ${esc(s.id)}`);
        s = await newSeason(day(1, s.end_date), day(71, s.end_date));
        await q(
          `UPDATE user_points SET total_points = 0, bonus_points = 0, current_streak_days = 0, last_points_date = NULL, current_season_id = ${esc(s.id)}, updated_at = ${esc(nowTs())}`,
        );
      }
      await q(
        `UPDATE user_points SET current_season_id = ${esc(s.id)}, updated_at = ${esc(nowTs())} WHERE user_id = ${esc(uid)} AND (current_season_id IS NULL OR current_season_id <> ${esc(s.id)})`,
      );
      return [{ id: s.id, name: s.name, start_date: s.start_date, end_date: s.end_date, season_number: s.season_number }];
    });
  },

  async charge_credit_usage(uid, { _amount_usd, _model, _input_tokens, _output_tokens }) {
    const amount = Number(_amount_usd);
    if (!Number.isFinite(amount) || amount < 0 || amount > 5) throw new ApiError("Ungültiger Betrag", "P0001");
    return tx(async (c) => {
      const now = new Date().toISOString().replace("T", " ").replace("Z", "");
      await c.query(
        `INSERT INTO user_credits (user_id, balance_usd) VALUES (${esc(uid)}, ${-amount}) ON DUPLICATE KEY UPDATE balance_usd = balance_usd - ${amount}, updated_at = ${esc(now)}`,
      );
      const [[{ balance_usd }]] = await c.query(`SELECT balance_usd FROM user_credits WHERE user_id = ${esc(uid)} FOR UPDATE`);
      await c.query(
        `INSERT INTO credit_ledger (id, user_id, kind, amount_usd, balance_after_usd, model, input_tokens, output_tokens, created_at)
         VALUES (${esc(randomUUID())}, ${esc(uid)}, 'usage', ${-amount}, ${balance_usd}, ${esc(_model)}, ${Number(_input_tokens) || 0}, ${Number(_output_tokens) || 0}, ${esc(now)})`,
      );
      return Number(balance_usd);
    });
  },

  async admin_credit_topup(uid, { _user_id, _amount_usd, _note = null, _kind = "topup" }) {
    const [adm] = await query(`SELECT ${hasRole(uid)} AS ok`);
    if (!bool(adm.ok)) throw new ApiError("Nur für Admins", "P0001");
    const amount = Number(_amount_usd);
    if (!["topup", "adjustment"].includes(_kind)) throw new ApiError("Ungültige Art", "P0001");
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10000) throw new ApiError("Ungültiger Betrag", "P0001");
    if (_kind === "topup" && amount < 0) throw new ApiError("Eine Aufladung muss positiv sein", "P0001");
    return tx(async (c) => {
      const now = new Date().toISOString().replace("T", " ").replace("Z", "");
      await c.query(
        `INSERT INTO user_credits (user_id, balance_usd) VALUES (${esc(_user_id)}, ${amount}) ON DUPLICATE KEY UPDATE balance_usd = balance_usd + ${amount}, updated_at = ${esc(now)}`,
      );
      const [[{ balance_usd }]] = await c.query(`SELECT balance_usd FROM user_credits WHERE user_id = ${esc(_user_id)} FOR UPDATE`);
      await c.query(
        `INSERT INTO credit_ledger (id, user_id, kind, amount_usd, balance_after_usd, note, created_at)
         VALUES (${esc(randomUUID())}, ${esc(_user_id)}, ${esc(_kind)}, ${amount}, ${balance_usd}, ${esc(String(_note ?? "").trim() || null)}, ${esc(now)})`,
      );
      return Number(balance_usd);
    });
  },

  async admin_credit_overview(uid) {
    const [adm] = await query(`SELECT ${hasRole(uid)} AS ok`);
    if (!bool(adm.ok)) throw new ApiError("Nur für Admins", "P0001");
    const rows = await query(
      `SELECT u.id AS user_id, p.username, u.email, COALESCE(c.balance_usd, 0) AS balance_usd,
              COALESCE(l.topped_up, 0) AS topped_up_usd, COALESCE(l.used, 0) AS used_usd,
              COALESCE(l.scans, 0) AS scans, l.last_used
       FROM users u
       LEFT JOIN user_profile p ON p.user_id = u.id
       LEFT JOIN user_credits c ON c.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                SUM(CASE WHEN amount_usd > 0 THEN amount_usd ELSE 0 END) AS topped_up,
                SUM(CASE WHEN kind = 'usage' THEN -amount_usd ELSE 0 END) AS used,
                SUM(kind = 'usage') AS scans,
                MAX(CASE WHEN kind = 'usage' THEN created_at END) AS last_used
         FROM credit_ledger GROUP BY user_id) l ON l.user_id = u.id
       ORDER BY COALESCE(l.used, 0) DESC, u.created_at`,
    );
    return fixTs(rows, "last_used");
  },
};

export async function callRpc(name, uid, args = {}) {
  const fn = handlers[name];
  if (!fn) throw new ApiError(`Funktion "${name}" nicht gefunden`, "PGRST202");
  return fn(uid, args);
}
