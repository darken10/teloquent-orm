import { Grammar } from "./Grammar.js";

export class SQLiteGrammar extends Grammar {
  protected openQuote = '"';
  protected closeQuote = '"';

  typeFor(type: string): string {
    const map: Record<string, string> = {
      increments: "integer",
      integer: "integer",
      bigInteger: "integer",
      string: "varchar",
      text: "text",
      boolean: "integer",
      float: "real",
      decimal: "numeric",
      datetime: "datetime",
      date: "date",
      timestamp: "datetime",
      json: "text",
    };
    return map[type] ?? "text";
  }

  autoIncrement(): string {
    return "primary key autoincrement";
  }
}
