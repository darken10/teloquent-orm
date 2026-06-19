import type { Model, CastType } from "./Model.js";

/**
 * Décorateurs optionnels et ergonomiques.
 *
 * Teloquent est « schemaless » comme Eloquent : déclarer ses colonnes n'est
 * PAS obligatoire. Ces décorateurs servent uniquement de sucre syntaxique
 * pour configurer la table, les casts ou la clé primaire au plus près du modèle.
 *
 *   @table("users")
 *   @casts({ is_active: "boolean", meta: "json" })
 *   class User extends Model {
 *     declare name: string;
 *   }
 */

export function table(name: string) {
  return function <T extends typeof Model>(target: T): T {
    (target as any).table = name;
    return target;
  };
}

export function primaryKey(name: string) {
  return function <T extends typeof Model>(target: T): T {
    (target as any).primaryKey = name;
    return target;
  };
}

export function casts(map: Record<string, CastType>) {
  return function <T extends typeof Model>(target: T): T {
    (target as any).casts = { ...(target as any).casts, ...map };
    return target;
  };
}

export function connection(name: string) {
  return function <T extends typeof Model>(target: T): T {
    (target as any).connectionName = name;
    return target;
  };
}
