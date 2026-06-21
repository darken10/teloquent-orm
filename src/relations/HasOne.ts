import type { Model } from "../eloquent/Model.js";
import { Relation } from "./Relation.js";
import { countChildren, correlatedExists, parentTable } from "./support.js";

/** Relation 1-1 : un User a un Profile (`profiles.user_id = users.id`). */
export class HasOne<R extends Model> extends Relation<R> {
  protected addConstraints(): void {
    this.query.where(this.foreignKey, this.parent.getAttribute(this.localKey)).limit(1);
  }

  async getResults(): Promise<R | null> {
    return this.query.first();
  }

  getKeys(parents: Model[]): unknown[] {
    return unique(parents.map((p) => p.getAttribute(this.localKey)));
  }

  async eager(keys: unknown[]): Promise<R[]> {
    const fresh = (this.related as any).query() as typeof this.query;
    return fresh.whereIn(this.foreignKey, keys).get();
  }

  async loadCount(parents: Model[], relationName: string): Promise<void> {
    await countChildren(this.related, this.foreignKey, this.localKey, parents, relationName);
  }

  existsSubquery(callback?: (q: any) => void) {
    const relatedTable = (this.related as unknown as typeof Model).getTable();
    return correlatedExists(
      this.related,
      `${relatedTable}.${this.foreignKey}`,
      `${parentTable(this.parent)}.${this.localKey}`,
      callback
    );
  }

  match(parents: Model[], results: R[], relationName: string): void {
    const byKey = new Map<string, R>();
    for (const child of results) byKey.set(String(child.getAttribute(this.foreignKey)), child);
    for (const parent of parents) {
      parent.setRelation(relationName, byKey.get(String(parent.getAttribute(this.localKey))) ?? null);
    }
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
