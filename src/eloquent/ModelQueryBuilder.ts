import { QueryBuilder } from "../query/QueryBuilder.js";
import type { Connection } from "../connection/Connection.js";
import type { Grammar } from "../query/grammars/Grammar.js";
import { Collection } from "./Collection.js";
import type { Model, ModelCtor } from "./Model.js";
import { getGlobalScopes } from "./scopes.js";
import { studly } from "../support/str.js";

type TrashMode = "default" | "with" | "only";

/**
 * Query Builder « Eloquent » : comme le QueryBuilder bas niveau, mais hydrate
 * les lignes en instances de modèle, gère l'eager loading (`with`), les scopes
 * (locaux/globaux) et les soft deletes.
 */
export class ModelQueryBuilder<T extends Model> extends QueryBuilder<any> {
  private eagerLoad: string[] = [];
  private trashMode: TrashMode = "default";
  private scopesApplied = false;

  constructor(
    connection: Connection,
    grammar: Grammar,
    private readonly model: ModelCtor<T>
  ) {
    super(connection, grammar);
  }

  /** Déclare les relations à charger en eager loading. */
  with(...relations: string[]): this {
    this.eagerLoad.push(...relations);
    return this;
  }

  // ----------------------------------------------------------- soft deletes
  /** Inclut aussi les enregistrements soft-deleted. */
  withTrashed(): this {
    this.trashMode = "with";
    return this;
  }

  /** Ne renvoie que les enregistrements soft-deleted. */
  onlyTrashed(): this {
    this.trashMode = "only";
    return this;
  }

  // ----------------------------------------------------------------- scopes
  /** Applique un scope local défini par `static scopeXxx(query, ...args)`. */
  scope(name: string, ...args: unknown[]): this {
    const method = `scope${studly(name)}`;
    const fn = (this.model as any)[method];
    if (typeof fn !== "function") {
      throw new Error(`Scope "${name}" introuvable : définissez ${this.model.name}.${method}().`);
    }
    fn.call(this.model, this, ...args);
    return this;
  }

  /** Applique scopes globaux + contrainte soft delete (idempotent). */
  private applyScopes(): void {
    if (this.scopesApplied) return;
    this.scopesApplied = true;

    for (const fn of getGlobalScopes(this.model).values()) fn(this);

    const m = this.model as typeof Model;
    if (m.softDeletes) {
      if (this.trashMode === "default") this.whereNull(m.deletedAtColumn);
      else if (this.trashMode === "only") this.whereNotNull(m.deletedAtColumn);
    }
  }

  // -------------------------------------------------------------- exécution
  override async get(): Promise<Collection<T>> {
    this.applyScopes();
    const rows = await super.get();
    const models = rows.map((row) => (this.model as any).hydrate(row) as T);
    if (this.eagerLoad.length && models.length) {
      await this.eagerLoadRelations(models);
    }
    return Collection.fromArray(models);
  }

  override async first(): Promise<T | null> {
    const rows = await this.limit(1).get();
    return rows.first();
  }

  async firstOrFail(): Promise<T> {
    const model = await this.first();
    if (!model) throw new Error(`Aucun ${this.model.name} ne correspond à la requête.`);
    return model;
  }

  override toSql(): { sql: string; bindings: unknown[] } {
    this.applyScopes();
    return super.toSql();
  }

  protected override async aggregate(fn: string, column = "*"): Promise<number> {
    this.applyScopes();
    return super.aggregate(fn, column);
  }

  /** Met à jour toutes les lignes correspondant à la requête. */
  override async update(data: Record<string, unknown>): Promise<number> {
    this.applyScopes();
    if ((this.model as typeof Model).timestamps) {
      data = { ...data, [(this.model as typeof Model).updatedAtColumn]: new Date() };
    }
    return super.update(data);
  }

  override async increment(
    column: string,
    amount = 1,
    extra: Record<string, unknown> = {}
  ): Promise<number> {
    this.applyScopes();
    return super.increment(column, amount, this.withTouch(extra));
  }

  override async decrement(
    column: string,
    amount = 1,
    extra: Record<string, unknown> = {}
  ): Promise<number> {
    this.applyScopes();
    return super.decrement(column, amount, this.withTouch(extra));
  }

  private withTouch(extra: Record<string, unknown>): Record<string, unknown> {
    const m = this.model as typeof Model;
    if (!m.timestamps) return extra;
    return { ...extra, [m.updatedAtColumn]: new Date() };
  }

  /** Soft delete en masse si activé, sinon suppression réelle. */
  override async delete(): Promise<number> {
    const m = this.model as typeof Model;
    if (m.softDeletes) {
      this.applyScopes();
      return super.update({ [m.deletedAtColumn]: new Date() });
    }
    this.applyScopes();
    return super.delete();
  }

  /** Suppression réelle, même pour un modèle à soft deletes. */
  async forceDelete(): Promise<number> {
    this.applyScopes();
    return super.delete();
  }

  private async eagerLoadRelations(models: T[]): Promise<void> {
    for (const name of this.eagerLoad) {
      const factory = (models[0] as any)[name];
      if (typeof factory !== "function") {
        throw new Error(
          `Relation "${name}" introuvable sur ${this.model.name}. ` +
            `Définissez une méthode ${name}() qui retourne this.hasMany/hasOne/belongsTo(...).`
        );
      }
      const relation = factory.call(models[0]);
      const keys = relation.getKeys(models);
      const results = await relation.eager(keys);
      relation.match(models, results, name);
    }
  }
}
