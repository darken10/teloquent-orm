import type { OrderDirection } from "../types/index.js";

export type BooleanJoin = "and" | "or";

export interface WhereClause {
  type: "basic" | "in" | "notIn" | "null" | "notNull" | "between" | "raw";
  boolean: BooleanJoin;
  column?: string;
  operator?: string;
  value?: unknown;
  values?: unknown[];
  sql?: string;
}

export interface OrderClause {
  column: string;
  direction: OrderDirection;
}

export interface JoinClause {
  table: string;
  first: string;
  operator: string;
  second: string;
  type: "inner" | "left" | "right";
}

/** État interne d'un QueryBuilder, lu par la Grammar pour générer le SQL. */
export interface QueryComponents {
  table: string;
  columns: string[];
  rawColumns: string[];
  distinct: boolean;
  wheres: WhereClause[];
  orders: OrderClause[];
  joins: JoinClause[];
  groups: string[];
  havings: WhereClause[];
  limit?: number;
  offset?: number;
  aggregate?: { fn: string; column: string };
}

/** SQL compilé + ses paramètres. */
export interface CompiledQuery {
  sql: string;
  bindings: unknown[];
}
