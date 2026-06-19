import type { Model } from "../eloquent/Model.js";
import { Collection } from "../eloquent/Collection.js";
import { Relation } from "./Relation.js";

/** Relation 1-N : un User a plusieurs Post (`posts.user_id = users.id`). */
export class HasMany<R extends Model> extends Relation<R> {
  protected addConstraints(): void {
    this.query.where(this.foreignKey, this.parent.getAttribute(this.localKey));
  }

  async getResults(): Promise<Collection<R>> {
    return this.query.get();
  }

  getKeys(parents: Model[]): unknown[] {
    return unique(parents.map((p) => p.getAttribute(this.localKey)));
  }

  async eager(keys: unknown[]): Promise<R[]> {
    const fresh = (this.related as any).query() as typeof this.query;
    return fresh.whereIn(this.foreignKey, keys).get();
  }

  match(parents: Model[], results: R[], relationName: string): void {
    const grouped = new Map<unknown, R[]>();
    for (const child of results) {
      const fk = child.getAttribute(this.foreignKey);
      if (!grouped.has(fk)) grouped.set(fk, []);
      grouped.get(fk)!.push(child);
    }
    for (const parent of parents) {
      const key = parent.getAttribute(this.localKey);
      parent.setRelation(relationName, Collection.fromArray(grouped.get(key) ?? []));
    }
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
