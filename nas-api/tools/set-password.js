// Setzt ein neues Passwort: docker compose exec api node tools/set-password.js mail@example.de NeuesPasswort123
import bcrypt from "bcryptjs";
import { query, esc, pool } from "../src/db.js";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error("Aufruf: node tools/set-password.js <email> <passwort (min. 8 Zeichen)>");
  process.exit(1);
}
const hash = await bcrypt.hash(password, 10);
const res = await query(`UPDATE users SET password_hash = ${esc(hash)} WHERE email = ${esc(email.toLowerCase())}`);
console.log(res.affectedRows ? "Passwort gesetzt." : "Kein Konto mit dieser E-Mail gefunden.");
await pool.end();
