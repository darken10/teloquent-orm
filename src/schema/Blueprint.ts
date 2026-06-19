import type { Grammar } from "../query/grammars/Grammar.js";

interface ColumnSpec {
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  isIncrements: boolean;
  default?: unknown;
  hasDefault: boolean;
}

/** Définition fluide d'une colonne (renvoyée par les méthodes du Blueprint). */
export class ColumnBuilder {
  constructor(private spec: ColumnSpec) {}
  nullable(): this {
    this.spec.nullable = true;
    return this;
  }
  unique(): this {
    this.spec.unique = true;
    return this;
  }
  default(value: unknown): this {
    this.spec.default = value;
    this.spec.hasDefault = true;
    return this;
  }
}

/**
 * Blueprint : décrit la structure d'une table.
 * Équivalent de `Illuminate\Database\Schema\Blueprint`.
 */
export class Blueprint {
  private columns: ColumnSpec[] = [];

  constructor(public readonly table: string) {}

  private add(name: string, type: string, opts: Partial<ColumnSpec> = {}): ColumnBuilder {
    const spec: ColumnSpec = {
      name,
      type,
      nullable: false,
      unique: false,
      isIncrements: false,
      hasDefault: false,
      ...opts,
    };
    this.columns.push(spec);
    return new ColumnBuilder(spec);
  }

  increments(name = "id"): ColumnBuilder {
    return this.add(name, "increments", { isIncrements: true });
  }
  integer(name: string): ColumnBuilder {
    return this.add(name, "integer");
  }
  bigInteger(name: string): ColumnBuilder {
    return this.add(name, "bigInteger");
  }
  string(name: string): ColumnBuilder {
    return this.add(name, "string");
  }
  text(name: string): ColumnBuilder {
    return this.add(name, "text");
  }
  boolean(name: string): ColumnBuilder {
    return this.add(name, "boolean");
  }
  float(name: string): ColumnBuilder {
    return this.add(name, "float");
  }
  decimal(name: string): ColumnBuilder {
    return this.add(name, "decimal");
  }
  datetime(name: string): ColumnBuilder {
    return this.add(name, "datetime");
  }
  date(name: string): ColumnBuilder {
    return this.add(name, "date");
  }
  timestamp(name: string): ColumnBuilder {
    return this.add(name, "timestamp");
  }
  json(name: string): ColumnBuilder {
    return this.add(name, "json");
  }

  /** Clé étrangère simple (colonne entière, sans contrainte FK pour le MVP). */
  foreignId(name: string): ColumnBuilder {
    return this.add(name, "bigInteger");
  }

  /** Ajoute created_at + updated_at nullable. */
  timestamps(): void {
    this.add("created_at", "datetime", { nullable: true });
    this.add("updated_at", "datetime", { nullable: true });
  }

  /** Compile le CREATE TABLE pour la grammar donnée. */
  toSql(grammar: Grammar): string {
    const cols = this.columns.map((c) => this.compileColumn(c, grammar));
    return `create table ${grammar.wrap(this.table)} (${cols.join(", ")})`;
  }

  private compileColumn(c: ColumnSpec, grammar: Grammar): string {
    const parts = [grammar.wrap(c.name), grammar.typeFor(c.type)];
    if (c.isIncrements) {
      parts.push(grammar.autoIncrement());
      return parts.join(" ");
    }
    parts.push(c.nullable ? "null" : "not null");
    if (c.hasDefault) parts.push(`default ${this.formatDefault(c.default)}`);
    if (c.unique) parts.push("unique");
    return parts.join(" ");
  }

  private formatDefault(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "1" : "0";
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}
