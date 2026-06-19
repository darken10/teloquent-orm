import type { Connection } from "../connection/Connection.js";
import type { Grammar } from "./grammars/Grammar.js";
import type { OrderDirection, WhereOperator } from "../types/index.js";
import type { BooleanJoin, QueryComponents, WhereClause } from "./types.js";

const OPERATORS = new Set([
  "=", "!=", "<>", "<", "<=", ">", ">=", "like", "not like",
]);

/** Résultat d'une pagination complète. */
export interface Paginator<D> {
  data: D;
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number;
  to: number;
}

/** Résultat d'une pagination « simple » (sans COUNT). */
export interface SimplePaginator<D> {
  data: D;
  perPage: number;
  currentPage: number;
  hasMore: boolean;
}

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

  // --------------------------------------------------------- pagination

  /** Limite/saute pour atteindre une page (1-indexée). */
  forPage(page: number, perPage: number): this {
    return this.offset((page - 1) * perPage).limit(perPage);
  }

  /**
   * Pagination complète avec total et nombre de pages.
   * `get()` / `count()` étant surchargés par ModelQueryBuilder, l'hydratation,
   * les scopes et les soft deletes sont automatiquement respectés.
   */
  async paginate(page = 1, perPage = 15): Promise<Paginator<Row[]>> {
    const total = await this.count();
    const data = await this.forPage(page, perPage).get();
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const from = total === 0 ? 0 : (page - 1) * perPage + 1;
    return {
      data,
      total,
      perPage,
      currentPage: page,
      lastPage,
      from,
      to: from === 0 ? 0 : from + data.length - 1,
    };
  }

  /** Pagination « simple » (sans COUNT) : indique seulement s'il y a une page suivante. */
  async simplePaginate(page = 1, perPage = 15): Promise<SimplePaginator<Row[]>> {
    // On récupère un élément de plus pour savoir s'il existe une page suivante,
    // mais l'offset reste basé sur perPage.
    const rows = await this.offset((page - 1) * perPage)
      .limit(perPage + 1)
      .get();
    const hasMore = rows.length > perPage;
    const data = (hasMore ? rows.slice(0, perPage) : rows) as Row[];
    return { data, perPage, currentPage: page, hasMore };
  }

  /** Traite les résultats par lots de `size` (mémoire-efficace). */
  async chunk(
    size: number,
    callback: (rows: Row[], page: number) => void | Promise<void>
  ): Promise<void> {
    let page = 1;
    let count = 0;
    do {
      const rows = await this.forPage(page, size).get();
      count = rows.length;
      if (count) await callback(rows, page);
      page++;
    } while (count === size);
  }

  // ------------------------------------------------------------ agrégats

  protected async aggregate(fn: string, column = "*"): Promise<number> {
    const clone = this.clone();
    clone.components.aggregate = { fn, column };
    clone.components.columns = [];
    clone.components.orders = [];
    clone.components.limit = undefined;
    clone.components.offset = undefined;
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

  /** Incrémente une colonne (UPDATE col = col + amount). */
  async increment(
    column: string,
    amount = 1,
    extra: Record<string, unknown> = {}
  ): Promise<number> {
    const { sql, bindings } = this.grammar.compileIncrement(this.components, column, amount, extra, false);
    return (await this.connection.statement(sql, bindings)).affectedRows;
  }

  /** Décrémente une colonne (UPDATE col = col - amount). */
  async decrement(
    column: string,
    amount = 1,
    extra: Record<string, unknown> = {}
  ): Promise<number> {
    const { sql, bindings } = this.grammar.compileIncrement(this.components, column, amount, extra, true);
    return (await this.connection.statement(sql, bindings)).affectedRows;
  }

  /** Insert ou met à jour en cas de conflit (sur `uniqueBy`). */
  async upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    uniqueBy: string[],
    updateColumns?: string[]
  ): Promise<number> {
    const list = Array.isArray(rows) ? rows : [rows];
    if (list.length === 0) return 0;
    const cols = Object.keys(list[0]);
    const update = updateColumns ?? cols.filter((c) => !uniqueBy.includes(c));
    const { sql, bindings } = this.grammar.compileUpsert(
      this.components.table,
      list,
      uniqueBy,
      update
    );
    return (await this.connection.statement(sql, bindings)).affectedRows;
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
