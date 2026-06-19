import type { ModelQueryBuilder } from "./ModelQueryBuilder.js";

/** Une contrainte appliquée automatiquement à toutes les requêtes d'un modèle. */
export type GlobalScope = (query: ModelQueryBuilder<any>) => void;

/** Registre des scopes globaux, par classe de modèle. */
const registry = new Map<Function, Map<string, GlobalScope>>();

export function registerGlobalScope(modelClass: Function, name: string, scope: GlobalScope): void {
  if (!registry.has(modelClass)) registry.set(modelClass, new Map());
  registry.get(modelClass)!.set(name, scope);
}

export function removeGlobalScope(modelClass: Function, name: string): void {
  registry.get(modelClass)?.delete(name);
}

/** Scopes globaux d'une classe, en remontant la chaîne d'héritage. */
export function getGlobalScopes(modelClass: Function): Map<string, GlobalScope> {
  const merged = new Map<string, GlobalScope>();
  let cls: Function | null = modelClass;
  const chain: Function[] = [];
  while (cls && cls !== Function.prototype) {
    chain.unshift(cls);
    cls = Object.getPrototypeOf(cls);
  }
  for (const c of chain) {
    const scopes = registry.get(c);
    if (scopes) for (const [name, fn] of scopes) merged.set(name, fn);
  }
  return merged;
}
