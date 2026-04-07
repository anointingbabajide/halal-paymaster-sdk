import { DBAdapter } from "../../sdk/db/adapter";

let dbAdapter: DBAdapter | null = null;

export const setDBAdapter = (adapter: DBAdapter): void => {
  dbAdapter = adapter;
};

// convert ? placeholders to $1 $2 $3 for PostgreSQL
const toPostgresPlaceholders = (sql: string): string => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

export const dbQuery = async <T = any>(
  sql: string,
  params: any[] = [],
): Promise<T[]> => {
  // SDK mode — use injected adapter (MySQL or PostgreSQL)
  if (dbAdapter) {
    return dbAdapter.query<T>(sql, params);
  }

  // standalone mode — use pg pool directly
  const { default: pool } = await import("./db");
  const pgSql = toPostgresPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows as T[];
};

export const getDBAdapter = (): DBAdapter | null => {
  return dbAdapter;
};
