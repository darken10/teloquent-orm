import { Grammar } from "./Grammar.js";

export class PostgresGrammar extends Grammar {
  protected openQuote = '"';
  protected closeQuote = '"';

  /** Postgres utilise les placeholders numérotés $1, $2, ... */
  protected finalize(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  typeFor(type: string): string {
    const map: Record<string, string> = {
      increments: "serial",
      integer: "integer",
      bigInteger: "bigint",
      string: "varchar(255)",
      text: "text",
      boolean: "boolean",
      float: "real",
      decimal: "numeric(8,2)",
      datetime: "timestamp",
      date: "date",
      timestamp: "timestamp",
      json: "jsonb",
    };
    return map[type] ?? "text";
  }

  autoIncrement(): string {
    // 'serial' gère déjà l'auto-incrément ; reste la contrainte PK.
    return "primary key";
  }
}
