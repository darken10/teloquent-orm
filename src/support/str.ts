/** Petites aides de chaîne (équivalent Str:: de Laravel, version minimale). */

export function snake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function studly(value: string): string {
  return value
    .replace(/[_\s-]+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** Pluralisation naïve (anglaise) suffisante pour déduire les noms de tables. */
export function plural(value: string): string {
  if (/[^aeiou]y$/i.test(value)) return value.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/i.test(value)) return value + "es";
  return value + "s";
}

/** Déduit le nom de table : "BlogPost" -> "blog_posts". */
export function tableName(className: string): string {
  return plural(snake(className));
}

/** Déduit la clé étrangère : "User" -> "user_id". */
export function foreignKey(className: string): string {
  return snake(className) + "_id";
}

/** Déduit le nom de la table pivot : ("User","Role") -> "role_user" (ordre alpha). */
export function pivotTable(a: string, b: string): string {
  return [snake(a), snake(b)].sort().join("_");
}
