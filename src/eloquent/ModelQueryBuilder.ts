import { QueryBuilder } from "../query/QueryBuilder.js";
import type { Connection } from "../connection/Connection.js";
import type { Grammar } from "../query/grammars/Grammar.js";
import { Collection } from "./Collection.js";
import type { Model, ModelCtor } from "./Model.js";

/**
 * Query Builder « Eloquent » : comme le QueryBuilder bas niveau,
 * mais hydrate les lignes en instances de modèle, gère l'eager loading
 * (`with`) et renvoie des Collection.
 */
export class ModelQueryBuilder<T extends Model> extends QueryBuilder<any> {
  private eagerLoad: string[] = [];

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

  override async get(): Promise<Collection<T>> {
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

  /** Met à jour toutes les lignes correspondant à la requête. */
  override async update(data: Record<string, unknown>): Promise<number> {
    if ((this.model as typeof Model).timestamps) {
      data = { ...data, [(this.model as typeof Model).updatedAtColumn]: new Date().toISOString() };
    }
    return super.update(data);
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
