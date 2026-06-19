import { Grammar } from "./Grammar.js";
import type { CompiledQuery } from "../types.js";

export class MySQLGrammar extends Grammar {
  protected openQuote = "`";
  protected closeQuote = "`";

  /** MySQL : ON DUPLICATE KEY UPDATE col = values(col). */
  override compileUpsert(
    table: string,
    rows: Record<string, unknown>[],
    _uniqueBy: string[],
    updateColumns: string[]
  ): CompiledQuery {
    const insert = this.compileInsert(table, rows);
    const updates = updateColumns
      .map((c) => `${this.wrap(c)} = values(${this.wrap(c)})`)
      .join(", ");
    return { sql: `${insert.sql} on duplicate key update ${updates}`, bindings: insert.bindings };
  }

  typeFor(type: string): string {
    const map: Record<string, string> = {
      increments: "int unsigned",
      integer: "int",
      bigInteger: "bigint",
      string: "varchar(255)",
      text: "text",
      boolean: "tinyint(1)",
      float: "float",
      decimal: "decimal(8,2)",
      datetime: "datetime",
      date: "date",
      timestamp: "timestamp",
      json: "json",
    };
    return map[type] ?? "text";
  }

  autoIncrement(): string {
    return "auto_increment primary key";
  }
}
