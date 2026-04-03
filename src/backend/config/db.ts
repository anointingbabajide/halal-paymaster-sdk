import { Pool } from "pg";
import config from "./index";

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
  process.exit(1);
});

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("PostgreSQL connection established");
    client.release();
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err);
    process.exit(1);
  }
};

export default pool;
