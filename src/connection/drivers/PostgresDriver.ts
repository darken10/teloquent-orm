import type { Bindings, ConnectionConfig, Driver, StatementResult } from "../../types/index.js";

/**
 * Driver PostgreSQL basé sur `pg`.
 *
 * STUB fonctionnel : la structure est en place, à compléter/tester.
 * Postgres utilise les placeholders `$1, $2...` : la PostgresGrammar
 * gère cette conversion lors de la compilation SQL.
 */
export class PostgresDriver implements Driver {
  readonly dialect = "pgsql" as const;

  private client: any = null;

  constructor(private readonly config: ConnectionConfig) {}

  async connect(): Promise<void> {
    if (this.client) return;
    let pg: any;
    try {
      // @ts-ignore — peerDependency optionnelle
      pg = await import("pg");
    } catch {
      throw new Error("Le driver PostgreSQL nécessite le paquet 'pg'. Installez-le : npm i pg");
    }
    this.client = new pg.Client({
      host: this.config.host ?? "127.0.0.1",
      port: this.config.port ?? 5432,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ...(this.config.options ?? {}),
    });
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  private ensure(): any {
    if (!this.client) throw new Error("Connexion Postgres non ouverte. Appelez connect() d'abord.");
    return this.client;
  }

  async select<T = Record<string, unknown>>(sql: string, bindings: Bindings): Promise<T[]> {
    const res = await this.ensure().query(sql, bindings);
    return res.rows as T[];
  }

  async statement(sql: string, bindings: Bindings): Promise<StatementResult> {
    const res = await this.ensure().query(sql, bindings);
    return {
      affectedRows: res.rowCount ?? 0,
      lastInsertId: res.rows?.[0]?.id,
    };
  }

  async beginTransaction(): Promise<void> {
    await this.ensure().query("BEGIN");
  }
  async commit(): Promise<void> {
    await this.ensure().query("COMMIT");
  }
  async rollback(): Promise<void> {
    await this.ensure().query("ROLLBACK");
  }
}
