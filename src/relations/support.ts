import type { Model, ModelCtor } from "../eloquent/Model.js";

/** Table d'un modèle parent (instance). */
export function parentTable(parent: Model): string {
  return (parent.constructor as unknown as typeof Model).getTable();
}

/**
 * Construit le SQL d'une sous-requête EXISTS corrélée côté "enfant"
 * (related.foreignCol = parent.parentCol), pour whereHas.
 */
export function correlatedExists(
  related: ModelCtor<Model>,
  foreignCol: string,
  parentCol: string,
  callback?: (q: any) => void
): { sql: string; bindings: unknown[] } {
  const cls = related as unknown as typeof Model;
  const q: any = (cls as any).query();
  q.whereColumn(foreignCol, "=", parentCol);
  if (callback) callback(q);
  return q.toRawSql();
}

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
