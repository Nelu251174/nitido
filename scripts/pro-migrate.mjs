import Database from "better-sqlite3";
import { migratePro } from "../src/lib/pro/schema.ts";
import fs from "node:fs";
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
    "Pro v1.1 migration complete; existing marketplace tables preserved.",
  );
} finally {
  db.close();
}
