import type { Connection } from "../connection/Connection.js";
import type { Grammar } from "./grammars/Grammar.js";
import type { OrderDirection, WhereOperator } from "../types/index.js";
import type { BooleanJoin, QueryComponents, WhereClause } from "./types.js";

const OPERATORS = new Set([
  "=", "!=", "<>", "<", "<=", ">", ">=", "like", "not like",
]);

/**
 * Query Builder fluide, inspiré de `Illuminate\Database\Query\Builder`.
 * Toutes les valeurs sont liées en paramètres (anti-injection SQL).
 */
export class QueryBuilder<Row = Record<string, unknown>> {
  protected components: QueryComponents = {
    table: "",
    columns: [],
    distinct: false,
    wheres: [],
    orders: [],
    joins: [],
    groups: [],
    havings: [],
  };

  constructor(
    protected readonly connection: Connection,
    protected readonly grammar: Grammar
  ) {}

  // ----------------------------------------------------------- construction

  from(table: string): this {
    this.components.table = table;
    return this;
  }

  select(...columns: string[]): this {
    this.components.columns = columns.length ? columns : [];
    return this;
  }

  distinct(): this {
    this.components.distinct = true;
    return this;
  }

  // ----------------------------------------------------------------- where

  where(column: string, value: unknown): this;
  where(column: string, operator: WhereOperator, value: unknown): this;
  where(column: string, operatorOrValue: unknown, value?: unknown): this {
    return this.addBasicWhere(column, operatorOrValue, value, "and");
  }

  orWhere(column: string, value: unknown): this;
  orWhere(column: string, operator: WhereOperator, value: unknown): this;
  orWhere(column: string, operatorOrValue: unknown, value?: unknown): this {
    return this.addBasicWhere(column, operatorOrValue, value, "or");
  }

  private addBasicWhere(
    column: string,
    operatorOrValue: unknown,
    value: unknown,
    boolean: BooleanJoin
  ): this {
    let operator: string;
    let val: unknown;
    if (value === undefined) {
      operator = "=";
      val = operatorOrValue;
    } else {
      operator = String(operatorOrValue).toLowerCase();
      val = value;
    }
    if (!OPERATORS.has(operator)) {
      throw new Error(`Opérateur invalide : "${operator}"`);
    }
    this.components.wheres.push({ type: "basic", column, operator, value: val, boolean });
    return this;
  }

  whereIn(column: string, values: unknown[], boolean: BooleanJoin = "and"): this {
    this.components.wheres.push({ type: "in", column, values, boolean });
    return this;
  }

  whereNotIn(column: string, values: unknown[], boolean: BooleanJoin = "and"): this {
    this.components.wheres.push({ type: "notIn", column, values, boolean });
    return this;
  }

  whereNull(column: string, boolean: BooleanJoin = "and"): this {
    this.components.wheres.push({ type: "null", column, boolean });
    return this;
  }

  whereNotNull(column: string, boolean: BooleanJoin = "and"): this {
    this.components.wheres.push({ type: "notNull", column, boolean });
    return this;
  }

  whereBetween(column: string, range: [unknown, unknown], boolean: BooleanJoin = "and"): this {
    this.components.wheres.push({ type: "between", column, values: range, boolean });
    return this;
  }

  whereRaw(sql: string, bindings: unknown[] = [], boolean: BooleanJoin = "and"): this {
    this.components.wheres.push({ type: "raw", sql, values: bindings, boolean });
    return this;
  }

  // ------------------------------------------------------------------ joins

  join(table: string, first: string, operator: string, second: string): this {
    this.components.joins.push({ table, first, operator, second, type: "inner" });
    return this;
  }

  leftJoin(table: string, first: string, operator: string, second: string): this {
    this.components.joins.push({ table, first, operator, second, type: "left" });
    return this;
  }

  // ----------------------------------------------------------- order/group

  orderBy(column: string, direction: OrderDirection = "asc"): this {
    this.components.orders.push({ column, direction });
    return this;
  }

  latest(column = "created_at"): this {
    return this.orderBy(column, "desc");
  }

  groupBy(...columns: string[]): this {
    this.components.groups.push(...columns);
    return this;
  }

  having(column: string, operator: WhereOperator, value: unknown): this {
    this.components.havings.push({
      type: "basic",
      column,
      operator: String(operator).toLowerCase(),
      value,
      boolean: "and",
    });
    return this;
  }

  limit(n: number): this {
    this.components.limit = n;
    return this;
  }

  offset(n: number): this {
    this.components.offset = n;
    return this;
  }

  take(n: number): this {
    return this.limit(n);
  }

  skip(n: number): this {
    return this.offset(n);
  }

  // --------------------------------------------------------------- lecture

  /** SQL + bindings (debug). */
  toSql(): { sql: string; bindings: unknown[] } {
    return this.grammar.compileSelect(this.components);
  }

  async get(): Promise<Row[]> {
    const { sql, bindings } = this.grammar.compileSelect(this.components);
    return this.connection.select<Row>(sql, bindings);
  }

  async first(): Promise<Row | null> {
    const rows = await this.limit(1).get();
    return rows[0] ?? null;
  }

  async value<T = unknown>(column: string): Promise<T | null> {
    const row = await this.select(column).first();
    if (!row) return null;
    return (row as Record<string, unknown>)[column.split(".").pop()!] as T;
  }

  async pluck<T = unknown>(column: string): Promise<T[]> {
    const rows = await this.select(column).get();
    const key = column.split(".").pop()!;
    return rows.map((r) => (r as Record<string, unknown>)[key] as T);
  }

  // ------------------------------------------------------------ agrégats

  protected async aggregate(fn: string, column = "*"): Promise<number> {
    const clone = this.clone();
    clone.components.aggregate = { fn, column };
    clone.components.columns = [];
    clone.components.orders = [];
    const { sql, bindings } = this.grammar.compileSelect(clone.components);
    const rows = await this.connection.select<{ aggregate: number | string }>(sql, bindings);
    return Number(rows[0]?.aggregate ?? 0);
  }

  count(column = "*"): Promise<number> {
    return this.aggregate("count", column);
  }
  max(column: string): Promise<number> {
    return this.aggregate("max", column);
  }
  min(column: string): Promise<number> {
    return this.aggregate("min", column);
  }
  sum(column: string): Promise<number> {
    return this.aggregate("sum", column);
  }
  avg(column: string): Promise<number> {
    return this.aggregate("avg", column);
  }

  async exists(): Promise<boolean> {
    return (await this.count()) > 0;
  }

  // --------------------------------------------------------------- écriture

  async insert(data: Record<string, unknown> | Record<string, unknown>[]): Promise<number> {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return 0;
    const { sql, bindings } = this.grammar.compileInsert(this.components.table, rows);
    const result = await this.connection.statement(sql, bindings);
    return result.affectedRows;
  }

  async insertGetId(data: Record<string, unknown>): Promise<number> {
    const { sql, bindings } = this.grammar.compileInsert(this.components.table, [data]);
    const result = await this.connection.statement(sql, bindings);
    return Number(result.lastInsertId ?? 0);
  }

  async update(data: Record<string, unknown>): Promise<number> {
    const { sql, bindings } = this.grammar.compileUpdate(this.components, data);
    const result = await this.connection.statement(sql, bindings);
    return result.affectedRows;
  }

  async delete(): Promise<number> {
    const { sql, bindings } = this.grammar.compileDelete(this.components);
    const result = await this.connection.statement(sql, bindings);
    return result.affectedRows;
  }

  // ---------------------------------------------------------------- utils

  /** Copie superficielle pour les sous-requêtes/agrégats. */
  clone(): QueryBuilder<Row> {
    const c = new QueryBuilder<Row>(this.connection, this.grammar);
    c.components = {
      ...this.components,
      columns: [...this.components.columns],
      wheres: [...this.components.wheres],
      orders: [...this.components.orders],
      joins: [...this.components.joins],
      groups: [...this.components.groups],
      havings: [...this.components.havings],
    };
    return c;
  }

  getComponents(): QueryComponents {
    return this.components;
  }
}
