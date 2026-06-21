import type { Model, ModelCtor } from "../eloquent/Model.js";

/**
 * Compte les enfants regroupés par clé étrangère et écrit `<relation>_count`
 * sur chaque parent. Partagé par HasMany et HasOne.
 */
export async function countChildren(
  related: ModelCtor<Model>,
  foreignKey: string,
  localKey: string,
  parents: Model[],
  relationName: string
): Promise<void> {
  const cls = related as unknown as typeof Model;
  const keys = [...new Set(parents.map((p) => p.getAttribute(localKey)))];
  const counts = new Map<string, number>();

  if (keys.length) {
    const q = cls
      .getConnection()
      .table(cls.getTable())
      .select(foreignKey)
      .selectRaw("count(*) as aggregate")
      .whereIn(foreignKey, keys)
      .groupBy(foreignKey);
    if (cls.softDeletes) q.whereNull(cls.deletedAtColumn);
    const rows = (await q.get()) as Array<Record<string, unknown>>;
    for (const r of rows) counts.set(String(r[foreignKey]), Number(r.aggregate));
  }

  for (const p of parents) {
    p.setAttribute(`${relationName}_count`, counts.get(String(p.getAttribute(localKey))) ?? 0);
  }
}
