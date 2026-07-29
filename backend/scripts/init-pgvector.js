import "dotenv/config";
import { initDatabase } from "../src/config/database.js";
import { initPgVector } from "../src/config/pgvector.js";

try {
  await initDatabase();
  await initPgVector();
  console.log("pgvector initialized.");
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
