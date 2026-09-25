import Database from "better-sqlite3";
import fs from "node:fs";
const schema = new URL("../src/lib/pro/schema.mjs", import.meta.url);
const { migratePro } = await import(fs.existsSync(schema) ? schema.href : new URL("../src/lib/pro/schema.ts", import.meta.url).href);
const file = process.env.NITIDO_PRO_DB_PATH;
if (!file || !fs.existsSync(file))
  throw new Error(
    "Set NITIDO_PRO_DB_PATH to an existing, backed-up NITIDO database.",
  );
const db = new Database(file);
db.pragma("foreign_keys=ON");
try {
  migratePro(db);
  console.log(
    "Pro v1.1 migration complete, including property checklist revision 12; existing marketplace tables preserved.",
  );
} finally {
  db.close();
}
