import type { CompiledQuery, QueryComponents, WhereClause } from "../types.js";

/**
 * Grammar de base : traduit l'état d'un QueryBuilder en SQL.
 * Les dialectes (SQLite/MySQL/Postgres) surchargent uniquement
 * ce qui diffère (quoting des identifiants, placeholders, types...).
 *
 * Toutes les valeurs passent par des paramètres liés (anti-injection).
 */
export abstract class Grammar {
  /** Caractère(s) d'échappement des identifiants. */
  protected openQuote = '"';
  protected closeQuote = '"';

  /** Entoure un identifiant : `users.name` -> `"users"."name"`. */
  wrap(identifier: string): string {
    if (identifier === "*") return "*";
    if (identifier.includes(" as ")) {
      const [col, alias] = identifier.split(/\s+as\s+/i);
      return `${this.wrap(col.trim())} as ${this.wrapSegment(alias.trim())}`;
    }
    return identifier
      .split(".")
      .map((seg) => (seg === "*" ? "*" : this.wrapSegment(seg)))
      .join(".");
  }

  protected wrapSegment(seg: string): string {
    return `${this.openQuote}${seg.replace(this.closeQuote, this.closeQuote + this.closeQuote)}${this.closeQuote}`;
  }

  protected columnize(columns: string[]): string {
    return columns.map((c) => this.wrap(c)).join(", ");
  }

  /** Hook final : permet à Postgres de convertir `?` en `$1, $2...`. */
  protected finalize(sql: string): string {
    return sql;
  }

  // ---------------------------------------------------------------- SELECT

  compileSelect(q: QueryComponents): CompiledQuery {
    const bindings: unknown[] = [];
    const parts: string[] = [];

    parts.push("select");
    if (q.aggregate) {
      const col = q.aggregate.column === "*" ? "*" : this.wrap(q.aggregate.column);
      parts.push(`${q.aggregate.fn}(${q.distinct && col !== "*" ? "distinct " : ""}${col}) as ${this.wrapSegment("aggregate")}`);
    } else {
      if (q.distinct) parts.push("distinct");
      parts.push(q.columns.length ? this.columnize(q.columns) : "*");
    }
    parts.push("from", this.wrap(q.table));

    for (const join of q.joins) {
      parts.push(
        `${join.type} join ${this.wrap(join.table)} on ${this.wrap(join.first)} ${join.operator} ${this.wrap(join.second)}`
      );
    }

    const where = this.compileWheres(q.wheres, bindings);
    if (where) parts.push("where", where);

    if (q.groups.length) parts.push("group by", this.columnize(q.groups));

    const having = this.compileWheres(q.havings, bindings, "having");
    if (having) parts.push("having", having);

    if (q.orders.length) {
      parts.push(
        "order by",
        q.orders.map((o) => `${this.wrap(o.column)} ${o.direction}`).join(", ")
      );
    }

    if (q.limit !== undefined) parts.push("limit", String(q.limit));
    if (q.offset !== undefined) parts.push("offset", String(q.offset));

    return { sql: this.finalize(parts.join(" ")), bindings };
  }

  // ---------------------------------------------------------------- WHERE

  protected compileWheres(
    wheres: WhereClause[],
    bindings: unknown[],
    _context: "where" | "having" = "where"
  ): string {
    if (!wheres.length) return "";
    const segments = wheres.map((w, i) => {
      const prefix = i === 0 ? "" : `${w.boolean} `;
      return prefix + this.compileWhere(w, bindings);
    });
    return segments.join(" ");
  }

  protected compileWhere(w: WhereClause, bindings: unknown[]): string {
    switch (w.type) {
      case "basic":
        bindings.push(w.value);
        return `${this.wrap(w.column!)} ${w.operator} ?`;
      case "in": {
        if (!w.values || w.values.length === 0) return "0 = 1";
        w.values.forEach((v) => bindings.push(v));
        return `${this.wrap(w.column!)} in (${w.values.map(() => "?").join(", ")})`;
      }
      case "notIn": {
        if (!w.values || w.values.length === 0) return "1 = 1";
        w.values.forEach((v) => bindings.push(v));
        return `${this.wrap(w.column!)} not in (${w.values.map(() => "?").join(", ")})`;
      }
      case "null":
        return `${this.wrap(w.column!)} is null`;
      case "notNull":
        return `${this.wrap(w.column!)} is not null`;
      case "between":
        bindings.push(w.values![0], w.values![1]);
        return `${this.wrap(w.column!)} between ? and ?`;
      case "raw":
        if (w.values) w.values.forEach((v) => bindings.push(v));
        return w.sql!;
      default:
        return "";
    }
  }

  // ---------------------------------------------------------------- INSERT

  compileInsert(table: string, rows: Record<string, unknown>[]): CompiledQuery {
    const bindings: unknown[] = [];
    const columns = Object.keys(rows[0]);
    const placeholders = rows
      .map((row) => {
        columns.forEach((c) => bindings.push(row[c]));
        return `(${columns.map(() => "?").join(", ")})`;
      })
      .join(", ");
    const sql = `insert into ${this.wrap(table)} (${this.columnize(columns)}) values ${placeholders}`;
    return { sql: this.finalize(sql), bindings };
  }

  /**
   * INSERT renvoyant la clé générée. Par défaut identique à compileInsert
   * (la clé est lue via lastInsertId du driver). Postgres surcharge avec RETURNING.
   */
  compileInsertGetId(
    table: string,
    row: Record<string, unknown>,
    _primaryKey = "id"
  ): CompiledQuery {
    return this.compileInsert(table, [row]);
  }

  // ---------------------------------------------------------------- UPDATE

  compileUpdate(q: QueryComponents, data: Record<string, unknown>): CompiledQuery {
    const bindings: unknown[] = [];
    const sets = Object.keys(data)
      .map((c) => {
        bindings.push(data[c]);
        return `${this.wrap(c)} = ?`;
      })
      .join(", ");
    let sql = `update ${this.wrap(q.table)} set ${sets}`;
    const where = this.compileWheres(q.wheres, bindings);
    if (where) sql += ` where ${where}`;
    return { sql: this.finalize(sql), bindings };
  }

  // ---------------------------------------------------------------- DELETE

  compileDelete(q: QueryComponents): CompiledQuery {
    const bindings: unknown[] = [];
    let sql = `delete from ${this.wrap(q.table)}`;
    const where = this.compileWheres(q.wheres, bindings);
    if (where) sql += ` where ${where}`;
    return { sql: this.finalize(sql), bindings };
  }

  // ------------------------------------------------------ INCREMENT / DECREMENT

  compileIncrement(
    q: QueryComponents,
    column: string,
    amount: number,
    extra: Record<string, unknown> = {},
    decrement = false
  ): CompiledQuery {
    const bindings: unknown[] = [];
    const op = decrement ? "-" : "+";
    const sets = [`${this.wrap(column)} = ${this.wrap(column)} ${op} ?`];
    bindings.push(Math.abs(amount));
    for (const [col, val] of Object.entries(extra)) {
      sets.push(`${this.wrap(col)} = ?`);
      bindings.push(val);
    }
    let sql = `update ${this.wrap(q.table)} set ${sets.join(", ")}`;
    const where = this.compileWheres(q.wheres, bindings);
    if (where) sql += ` where ${where}`;
    return { sql: this.finalize(sql), bindings };
  }

  // ---------------------------------------------------------------- UPSERT

  /**
   * Style « ON CONFLICT ... DO UPDATE SET col = excluded.col » (SQLite, Postgres).
   * MySQL surcharge cette méthode.
   */
  compileUpsert(
    table: string,
    rows: Record<string, unknown>[],
    uniqueBy: string[],
    updateColumns: string[]
  ): CompiledQuery {
    const insert = this.compileInsert(table, rows); // déjà finalisé (placeholders OK)
    const conflict = uniqueBy.map((c) => this.wrap(c)).join(", ");
    const updates = updateColumns
      .map((c) => `${this.wrap(c)} = excluded.${this.wrap(c)}`)
      .join(", ");
    // La partie ajoutée ne contient aucun placeholder : sûr d'appender après finalize.
    const sql = `${insert.sql} on conflict (${conflict}) do update set ${updates}`;
    return { sql, bindings: insert.bindings };
  }

  // ---------------------------------------------------------------- SCHEMA

  /** Type SQL d'une colonne selon le type abstrait du Blueprint. */
  abstract typeFor(type: string): string;

  /** Mot-clé auto-incrément pour une clé primaire entière. */
  abstract autoIncrement(): string;
}
