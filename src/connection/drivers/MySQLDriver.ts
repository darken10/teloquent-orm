import type { Bindings, ConnectionConfig, Driver, StatementResult } from "../../types/index.js";

/**
 * Driver MySQL / MariaDB basé sur `mysql2/promise`.
 *
 * STUB fonctionnel : la structure est en place, à compléter/tester.
 * mysql2 est asynchrone et utilise le placeholder `?` (comme SQLite),
 * donc la BaseGrammar convient sans surcharge de paramètres.
 */
export class MySQLDriver implements Driver {
  readonly dialect = "mysql" as const;

  private conn: any = null;

  constructor(private readonly config: ConnectionConfig) {}

  async connect(): Promise<void> {
    if (this.conn) return;
    let mysql: any;
    try {
      // @ts-ignore — peerDependency optionnelle
      mysql = await import("mysql2/promise");
    } catch {
      throw new Error("Le driver MySQL nécessite le paquet 'mysql2'. Installez-le : npm i mysql2");
    }
    this.conn = await mysql.createConnection({
      host: this.config.host ?? "127.0.0.1",
      port: this.config.port ?? 3306,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ...(this.config.options ?? {}),
    });
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      await this.conn.end();
      this.conn = null;
    }
  }

  private ensure(): any {
    if (!this.conn) throw new Error("Connexion MySQL non ouverte. Appelez connect() d'abord.");
    return this.conn;
  }

  async select<T = Record<string, unknown>>(sql: string, bindings: Bindings): Promise<T[]> {
    const [rows] = await this.ensure().query(sql, bindings);
    return rows as T[];
  }

  async statement(sql: string, bindings: Bindings): Promise<StatementResult> {
    const [result] = await this.ensure().query(sql, bindings);
    return {
      affectedRows: result.affectedRows ?? 0,
      lastInsertId: result.insertId,
    };
  }

  async beginTransaction(): Promise<void> {
    await this.ensure().beginTransaction();
  }
  async commit(): Promise<void> {
    await this.ensure().commit();
  }
  async rollback(): Promise<void> {
    await this.ensure().rollback();
  }
}
