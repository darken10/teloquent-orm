import type { Connection } from "../connection/Connection.js";
import { ConnectionManager } from "../connection/ConnectionManager.js";
import { Blueprint } from "./Blueprint.js";

/**
 * Façade de manipulation de schéma (équivalent de `Schema::`).
 * Utilise la connexion par défaut si aucune n'est fournie.
 */
export class SchemaBuilder {
  constructor(private readonly connection: Connection) {}

  static connection(name?: string): SchemaBuilder {
    return new SchemaBuilder(ConnectionManager.connection(name));
  }

  async create(table: string, callback: (table: Blueprint) => void): Promise<void> {
    const blueprint = new Blueprint(table);
    callback(blueprint);
    const sql = blueprint.toSql(this.connection.getGrammar());
    await this.connection.statement(sql);
  }

  /** Modifie une table existante (ALTER : ajout/suppression de colonnes). */
  async table(table: string, callback: (table: Blueprint) => void): Promise<void> {
    const blueprint = new Blueprint(table);
    callback(blueprint);
    for (const sql of blueprint.toAlterSql(this.connection.getGrammar())) {
      await this.connection.statement(sql);
    }
  }

  /** Indique si une table existe (best-effort, cross-dialecte). */
  async hasTable(table: string): Promise<boolean> {
    try {
      await this.connection.select(`select 1 from ${this.connection.getGrammar().wrap(table)} limit 1`);
      return true;
    } catch {
      return false;
    }
  }

  async drop(table: string): Promise<void> {
    await this.connection.statement(`drop table ${this.connection.getGrammar().wrap(table)}`);
  }

  async dropIfExists(table: string): Promise<void> {
    await this.connection.statement(
      `drop table if exists ${this.connection.getGrammar().wrap(table)}`
    );
  }
}

/** Helper court : Schema().create(...) sur la connexion par défaut. */
export function Schema(name?: string): SchemaBuilder {
  return SchemaBuilder.connection(name);
}
