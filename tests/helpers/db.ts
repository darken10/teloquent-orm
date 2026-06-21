import { ConnectionManager } from "../../src/index.js";
import type { ConnectionConfig, Dialect } from "../../src/index.js";

/**
 * Dialecte de test, piloté par la variable d'env TELOQUENT_DIALECT
 * (sqlite par défaut). Permet de rejouer la même suite sur MySQL/PostgreSQL.
 */
export function testDialect(): Dialect {
  const d = (process.env.TELOQUENT_DIALECT ?? "sqlite").toLowerCase();
  if (d === "mysql" || d === "mariadb") return "mysql";
  if (d === "pgsql" || d === "postgres" || d === "postgresql") return "pgsql";
  return "sqlite";
}

/** Config de connexion de test selon le dialecte (valeurs alignées sur docker-compose). */
export function testConfig(): ConnectionConfig {
  switch (testDialect()) {
    case "mysql":
      return {
        driver: "mysql",
        host: process.env.MYSQL_HOST ?? "127.0.0.1",
        port: Number(process.env.MYSQL_PORT ?? 3307),
        username: process.env.MYSQL_USER ?? "root",
        password: process.env.MYSQL_PASSWORD ?? "teloquent",
        database: process.env.MYSQL_DATABASE ?? "teloquent",
      };
    case "pgsql":
      return {
        driver: "pgsql",
        host: process.env.PG_HOST ?? "127.0.0.1",
        port: Number(process.env.PG_PORT ?? 5432),
        username: process.env.PG_USER ?? "teloquent",
        password: process.env.PG_PASSWORD ?? "teloquent",
        database: process.env.PG_DATABASE ?? "teloquent",
      };
    default:
      return { driver: "sqlite", database: ":memory:" };
  }
}

/** Tente une connexion : renvoie true si le driver/serveur est disponible. */
export async function probeConnection(): Promise<boolean> {
  try {
    await ConnectionManager.addConnection(testConfig());
    await ConnectionManager.connection().select("select 1 as ok");
    await ConnectionManager.closeAll();
    return true;
  } catch {
    try {
      await ConnectionManager.closeAll();
    } catch {
      /* ignore */
    }
    return false;
  }
}
