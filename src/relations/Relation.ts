import type { Model, ModelCtor } from "../eloquent/Model.js";
import type { ModelQueryBuilder } from "../eloquent/ModelQueryBuilder.js";
import type { OrderDirection, WhereOperator } from "../types/index.js";

/**
 * Base abstraite des relations. Gère le chaînage (`where`, `orderBy`...)
 * en déléguant à une requête contrainte, et fournit l'API d'eager loading
 * utilisée par `ModelQueryBuilder.with()`.
 */
export abstract class Relation<R extends Model> {
  protected query: ModelQueryBuilder<R>;

  constructor(
    protected related: ModelCtor<R>,
    protected parent: Model,
    public foreignKey: string,
    public localKey: string
  ) {
    this.query = (this.related as any).query();
    this.addConstraints();
  }

  /** Contrainte propre au parent (relation paresseuse). */
  protected abstract addConstraints(): void;

  /** Résout la relation pour le parent courant. */
  abstract getResults(): Promise<R | R[] | null>;

  /** Clés du côté parent à utiliser pour l'eager loading. */
  abstract getKeys(parents: Model[]): unknown[];

  /** Charge tous les enfants pour un lot de parents (1 seule requête). */
  abstract eager(keys: unknown[]): Promise<R[]>;

  /** Distribue les résultats chargés sur chaque parent. */
  abstract match(parents: Model[], results: R[], relationName: string): void;

  // ------------------------------------------------------ délégation fluide
  where(column: string, operator: WhereOperator | unknown, value?: unknown): ModelQueryBuilder<R> {
    return value === undefined
      ? this.query.where(column, operator)
      : this.query.where(column, operator as WhereOperator, value);
  }
  orderBy(column: string, direction: OrderDirection = "asc"): ModelQueryBuilder<R> {
    return this.query.orderBy(column, direction);
  }
  limit(n: number): ModelQueryBuilder<R> {
    return this.query.limit(n);
  }
  getQuery(): ModelQueryBuilder<R> {
    return this.query;
  }
  get() {
    return this.query.get();
  }
  first() {
    return this.query.first();
  }
}
