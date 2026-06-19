/**
 * Types partagés à travers tout Teloquent.
 */

export type Dialect = "sqlite" | "mysql" | "pgsql";

export type Bindings = unknown[];

/** Résultat brut d'une requête d'écriture (INSERT/UPDATE/DELETE/DDL). */
export interface StatementResult {
  /** Nombre de lignes affectées. */
  affectedRows: number;
  /** Dernier id auto-incrémenté inséré (si applicable). */
  lastInsertId?: number | bigint;
}

/** Configuration d'une connexion. */
export interface ConnectionConfig {
  driver: Dialect;
  /** Pour SQLite : chemin du fichier ou ":memory:". */
  database?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  /** Options spécifiques au driver. */
  options?: Record<string, unknown>;
}

/** Contrat bas niveau qu'implémente chaque driver de base de données. */
export interface Driver {
  /** Ouvre la connexion physique. */
  connect(): Promise<void>;
  /** Ferme la connexion. */
  disconnect(): Promise<void>;
  /** Exécute un SELECT et renvoie les lignes. */
  select<T = Record<string, unknown>>(sql: string, bindings: Bindings): Promise<T[]>;
  /** Exécute une écriture (INSERT/UPDATE/DELETE) ou du DDL. */
  statement(sql: string, bindings: Bindings): Promise<StatementResult>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  /** Dialecte SQL géré par ce driver. */
  readonly dialect: Dialect;
}

/** Direction d'un tri. */
export type OrderDirection = "asc" | "desc";

/** Opérateurs autorisés dans un where. */
export type WhereOperator =
  | "="
  | "!="
  | "<>"
  | "<"
  | "<="
  | ">"
  | ">="
  | "like"
  | "not like"
  | "in"
  | "not in"
  | "is null"
  | "is not null"
  | "between";
