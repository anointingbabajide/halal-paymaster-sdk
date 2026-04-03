import fs from "fs";
import path from "path";
import pool from "../config/db";

const runMigrations = async () => {
  try {
    // create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        ran_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // get already ran migrations
    const { rows } = await pool.query("SELECT filename FROM migrations");
    const ranMigrations = rows.map((r) => r.filename);

    // get all migration files in order
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // run pending migrations
    for (const file of files) {
      if (ranMigrations.includes(file)) {
        console.log(`Skipping already ran migration: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      console.log(`Running migration: ${file}`);
      await pool.query(sql);
      await pool.query("INSERT INTO migrations (filename) VALUES ($1)", [file]);
      console.log(`Migration complete: ${file}`);
    }

    console.log("All migrations ran successfully");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

runMigrations();
