import type { Bindings, Driver, StatementResult } from "../types/index.js";
import type { Grammar } from "../query/grammars/Grammar.js";
import { QueryBuilder } from "../query/QueryBuilder.js";

/**
 * Une connexion = un driver (I/O bas niveau) + une grammar (génération SQL).
 * C'est le point d'entrée pour construire des requêtes.
 */
export class Connection {
  private transactionDepth = 0;

  constructor(
    private readonly driver: Driver,
    private readonly grammar: Grammar
  ) {}

  get dialect() {
    return this.driver.dialect;
  }

  getGrammar(): Grammar {
    return this.grammar;
  }

  async connect(): Promise<void> {
    await this.driver.connect();
  }

  async disconnect(): Promise<void> {
    await this.driver.disconnect();
  }

  /** Démarre un QueryBuilder sur une table. */
  table(name: string): QueryBuilder {
    return new QueryBuilder(this, this.grammar).from(name);
  }

  /** Nouveau QueryBuilder vierge. */
  query(): QueryBuilder {
    return new QueryBuilder(this, this.grammar);
  }

  async select<T = Record<string, unknown>>(sql: string, bindings: Bindings = []): Promise<T[]> {
    return this.driver.select<T>(sql, bindings);
  }

  async statement(sql: string, bindings: Bindings = []): Promise<StatementResult> {
    return this.driver.statement(sql, bindings);
  }

  /**
   * Exécute un callback dans une transaction. Commit si succès,
   * rollback si exception. (Transactions imbriquées simplifiées.)
   */
  async transaction<T>(callback: (conn: Connection) => Promise<T>): Promise<T> {
    if (this.transactionDepth === 0) {
      await this.driver.beginTransaction();
    }
    this.transactionDepth++;
    try {
      const result = await callback(this);
      this.transactionDepth--;
      if (this.transactionDepth === 0) {
        await this.driver.commit();
      }
      return result;
    } catch (err) {
      this.transactionDepth--;
      if (this.transactionDepth === 0) {
        await this.driver.rollback();
      }
      throw err;
    }
  }
}
