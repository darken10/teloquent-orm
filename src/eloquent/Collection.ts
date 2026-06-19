/**
 * Collection : tableau enrichi retourné par les requêtes de modèles.
 * Inspirée de `Illuminate\Support\Collection` (sous-ensemble utile).
 */
export class Collection<T> extends Array<T> {
  static fromArray<T>(items: T[]): Collection<T> {
    const c = new Collection<T>();
    items.forEach((i) => c.push(i));
    return c;
  }

  /** Premier élément ou null. */
  first(): T | null {
    return this.length ? this[0] : null;
  }

  /** Dernier élément ou null. */
  last(): T | null {
    return this.length ? this[this.length - 1] : null;
  }

  isEmpty(): boolean {
    return this.length === 0;
  }

  /** Extrait une colonne de chaque élément. */
  pluck<K extends keyof T>(key: K): Array<T[K]> {
    return this.map((i) => i[key]);
  }

  /** Indexe par une clé. */
  keyBy<K extends keyof T>(key: K): Map<T[K], T> {
    const map = new Map<T[K], T>();
    this.forEach((i) => map.set(i[key], i));
    return map;
  }

  /** Regroupe par une clé. */
  groupBy<K extends keyof T>(key: K): Map<T[K], T[]> {
    const map = new Map<T[K], T[]>();
    this.forEach((i) => {
      const k = i[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    });
    return map;
  }

  toArray(): T[] {
    return [...this];
  }

  toJSON(): unknown[] {
    return this.map((i) => (i && typeof (i as any).toJSON === "function" ? (i as any).toJSON() : i));
  }
}
