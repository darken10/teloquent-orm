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

  existsSubquery(callback?: (q: any) => void) {
    const cls = this.related as unknown as typeof Model;
    const parentTbl = (this.parent.constructor as unknown as typeof Model).getTable();
    const q: any = (cls as any).query();
    q.whereColumn(`${cls.getTable()}.${this.localKey}`, "=", `${parentTbl}.${this.foreignKey}`);
    if (callback) callback(q);
    return q.toRawSql();
  }

  async loadCount(parents: Model[], relationName: string): Promise<void> {
    const cls = this.related as unknown as typeof Model;
    const keys = [...new Set(parents.map((p) => p.getAttribute(this.foreignKey)))];
    const present = new Set<string>();
    if (keys.length) {
      const rows = (await cls
        .getConnection()
        .table(cls.getTable())
        .select(this.localKey)
        .whereIn(this.localKey, keys)
        .get()) as Array<Record<string, unknown>>;
      for (const r of rows) present.add(String(r[this.localKey]));
    }
    for (const p of parents) {
      p.setAttribute(`${relationName}_count`, present.has(String(p.getAttribute(this.foreignKey))) ? 1 : 0);
    }
  }

  match(parents: Model[], results: R[], relationName: string): void {
    const byOwner = new Map<string, R>();
    for (const owner of results) byOwner.set(String(owner.getAttribute(this.localKey)), owner);
    for (const parent of parents) {
      parent.setRelation(relationName, byOwner.get(String(parent.getAttribute(this.foreignKey))) ?? null);
    }
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
