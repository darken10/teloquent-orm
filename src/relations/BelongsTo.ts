import type { Model } from "../eloquent/Model.js";
import { Relation } from "./Relation.js";

/**
 * Relation inverse N-1 : un Post appartient à un User
 * (`posts.user_id = users.id`). Ici `foreignKey` est porté par le parent
 * et `localKey` est la clé propriétaire (ownerKey) du modèle lié.
 */
export class BelongsTo<R extends Model> extends Relation<R> {
  protected addConstraints(): void {
    this.query.where(this.localKey, this.parent.getAttribute(this.foreignKey)).limit(1);
  }

  async getResults(): Promise<R | null> {
    return this.query.first();
  }

  getKeys(parents: Model[]): unknown[] {
    return unique(parents.map((p) => p.getAttribute(this.foreignKey)));
  }

  async eager(keys: unknown[]): Promise<R[]> {
    const fresh = (this.related as any).query() as typeof this.query;
    return fresh.whereIn(this.localKey, keys).get();
  }

  match(parents: Model[], results: R[], relationName: string): void {
    const byOwner = new Map<unknown, R>();
    for (const owner of results) byOwner.set(owner.getAttribute(this.localKey), owner);
    for (const parent of parents) {
      parent.setRelation(relationName, byOwner.get(parent.getAttribute(this.foreignKey)) ?? null);
    }
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
