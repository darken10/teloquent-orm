import type { Model, ModelCtor } from "../eloquent/Model.js";
import type { ModelQueryBuilder } from "../eloquent/ModelQueryBuilder.js";
import type { OrderDirection, WhereOperator } from "../types/index.js";
import { Collection } from "../eloquent/Collection.js";

const PIVOT_FK = "__pivot_fk__";

/**
 * Relation N-N via une table pivot (équivalent `belongsToMany` d'Eloquent).
 * Ex. User <-> Role avec la table pivot `role_user`.
 *
 * N'étend pas `Relation` car son constructeur a besoin de plusieurs clés
 * (pivot, clés des deux côtés) avant de poser ses contraintes.
 */
export class BelongsToMany<R extends Model> {
  private query: ModelQueryBuilder<R>;
  private readonly relatedTable: string;

  constructor(
    private readonly related: ModelCtor<R>,
    private readonly parent: Model,
    /** Table pivot. */
    public readonly table: string,
    /** Clé du parent dans le pivot (ex. user_id). */
    public readonly foreignPivotKey: string,
    /** Clé du modèle lié dans le pivot (ex. role_id). */
    public readonly relatedPivotKey: string,
    /** Clé primaire du parent. */
    public readonly parentKey: string,
    /** Clé primaire du modèle lié. */
    public readonly relatedKey: string
  ) {
    this.relatedTable = (related as typeof Model).getTable();
    this.query = (this.related as any).query();
    this.addConstraints();
  }

  private addConstraints(): void {
    this.query
      .select(`${this.relatedTable}.*`)
      .join(
        this.table,
        `${this.relatedTable}.${this.relatedKey}`,
        "=",
        `${this.table}.${this.relatedPivotKey}`
      )
      .where(`${this.table}.${this.foreignPivotKey}`, this.parent.getAttribute(this.parentKey));
  }

  // ----------------------------------------------------- délégation fluide
  where(column: string, operator: WhereOperator | unknown, value?: unknown): ModelQueryBuilder<R> {
    return value === undefined
      ? this.query.where(column, operator)
      : this.query.where(column, operator as WhereOperator, value);
  }
  orderBy(column: string, direction: OrderDirection = "asc"): ModelQueryBuilder<R> {
    return this.query.orderBy(column, direction);
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

  async getResults(): Promise<Collection<R>> {
    return this.query.get();
  }

  // -------------------------------------------------------- eager loading
  getKeys(parents: Model[]): unknown[] {
    return [...new Set(parents.map((p) => p.getAttribute(this.parentKey)))];
  }

  async eager(keys: unknown[]): Promise<R[]> {
    const q = (this.related as any).query() as ModelQueryBuilder<R>;
    return q
      .select(
        `${this.relatedTable}.*`,
        `${this.table}.${this.foreignPivotKey} as ${PIVOT_FK}`
      )
      .join(
        this.table,
        `${this.relatedTable}.${this.relatedKey}`,
        "=",
        `${this.table}.${this.relatedPivotKey}`
      )
      .whereIn(`${this.table}.${this.foreignPivotKey}`, keys)
      .get();
  }

  match(parents: Model[], results: R[], relationName: string): void {
    const grouped = new Map<string, R[]>();
    for (const child of results) {
      const fk = String(child.getAttribute(PIVOT_FK));
      delete (child.getRawAttributes() as Record<string, unknown>)[PIVOT_FK]; // nettoyage
      if (!grouped.has(fk)) grouped.set(fk, []);
      grouped.get(fk)!.push(child);
    }
    for (const parent of parents) {
      const key = String(parent.getAttribute(this.parentKey));
      parent.setRelation(relationName, Collection.fromArray(grouped.get(key) ?? []));
    }
  }

  async loadCount(parents: Model[], relationName: string): Promise<void> {
    const keys = [...new Set(parents.map((p) => p.getAttribute(this.parentKey)))];
    const counts = new Map<string, number>();
    if (keys.length) {
      const rows = (await this.connection()
        .table(this.table)
        .select(this.foreignPivotKey)
        .selectRaw("count(*) as aggregate")
        .whereIn(this.foreignPivotKey, keys)
        .groupBy(this.foreignPivotKey)
        .get()) as Array<Record<string, unknown>>;
      for (const r of rows) counts.set(String(r[this.foreignPivotKey]), Number(r.aggregate));
    }
    for (const p of parents) {
      p.setAttribute(`${relationName}_count`, counts.get(String(p.getAttribute(this.parentKey))) ?? 0);
    }
  }

  // ----------------------------------------------------- gestion du pivot
  private connection() {
    return (this.parent.constructor as typeof Model).getConnection();
  }
  private parentId() {
    return this.parent.getAttribute(this.parentKey);
  }

  /** Lie un ou plusieurs enregistrements (avec colonnes pivot optionnelles). */
  async attach(ids: unknown | unknown[], extra: Record<string, unknown> = {}): Promise<void> {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    const rows = list.map((id) => ({
      [this.foreignPivotKey]: this.parentId(),
      [this.relatedPivotKey]: id,
      ...extra,
    }));
    await this.connection().table(this.table).insert(rows);
  }

  /** Détache des liaisons (toutes si `ids` omis). Renvoie le nombre supprimé. */
  async detach(ids?: unknown | unknown[]): Promise<number> {
    const q = this.connection().table(this.table).where(this.foreignPivotKey, this.parentId());
    if (ids !== undefined) {
      q.whereIn(this.relatedPivotKey, Array.isArray(ids) ? ids : [ids]);
    }
    return q.delete();
  }

  /** Synchronise : la liste finale de liaisons = exactement `ids`. */
  async sync(ids: unknown[]): Promise<void> {
    await this.detach();
    await this.attach(ids);
  }
}
