import { Grammar } from "./Grammar.js";

export class MySQLGrammar extends Grammar {
  protected openQuote = "`";
  protected closeQuote = "`";

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
