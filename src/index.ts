/**
 * Teloquent — ORM TypeScript Active Record inspiré de Laravel Eloquent.
 * Point d'entrée public du package.
 */

// Cœur Active Record
export { Model } from "./eloquent/Model.js";
export type { Attributes, CastType, ModelCtor } from "./eloquent/Model.js";
export { Collection } from "./eloquent/Collection.js";
export { ModelQueryBuilder } from "./eloquent/ModelQueryBuilder.js";
export * from "./eloquent/decorators.js";

// Connexions
export { ConnectionManager } from "./connection/ConnectionManager.js";
export { Connection } from "./connection/Connection.js";

// Query builder bas niveau
export { QueryBuilder } from "./query/QueryBuilder.js";
export { Grammar } from "./query/grammars/Grammar.js";
export { SQLiteGrammar } from "./query/grammars/SQLiteGrammar.js";
export { MySQLGrammar } from "./query/grammars/MySQLGrammar.js";
export { PostgresGrammar } from "./query/grammars/PostgresGrammar.js";

// Relations
export { Relation } from "./relations/Relation.js";
export { HasMany } from "./relations/HasMany.js";
export { HasOne } from "./relations/HasOne.js";
export { BelongsTo } from "./relations/BelongsTo.js";

// Schéma & migrations
export { Schema, SchemaBuilder } from "./schema/SchemaBuilder.js";
export { Blueprint, ColumnBuilder } from "./schema/Blueprint.js";
export { Migration } from "./schema/Migration.js";

// Événements
export * as ModelEvents from "./events/ModelEvents.js";

// Types
export type {
  ConnectionConfig,
  Dialect,
  Driver,
  StatementResult,
  OrderDirection,
  WhereOperator,
} from "./types/index.js";
