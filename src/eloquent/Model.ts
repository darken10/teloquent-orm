import type { Connection } from "../connection/Connection.js";
import { ConnectionManager } from "../connection/ConnectionManager.js";
import { ModelQueryBuilder } from "./ModelQueryBuilder.js";
import { HasMany } from "../relations/HasMany.js";
import { HasOne } from "../relations/HasOne.js";
import { BelongsTo } from "../relations/BelongsTo.js";
import { tableName as deriveTable, studly, foreignKey as deriveFk } from "../support/str.js";
import { fireModelEvent, type ModelEvent } from "../events/ModelEvents.js";

export type Attributes = Record<string, unknown>;
export type CastType = "int" | "float" | "boolean" | "string" | "json" | "date" | "datetime";

type ModelCtor<T extends Model = Model> = (new (attrs?: Attributes) => T) & typeof Model;

/**
 * Classe de base Active Record, cœur de Teloquent.
 * On utilise un `Proxy` pour reproduire l'accès magique aux attributs
 * d'Eloquent (`user.name`, `user.name = ...`).
 */
export class Model {
  // ----------------------------------------------- configuration statique
  /** Nom de table (déduit du nom de classe si absent). */
  static table?: string;
  static primaryKey = "id";
  static incrementing = true;
  static connectionName?: string;
  static timestamps = true;
  static createdAtColumn = "created_at";
  static updatedAtColumn = "updated_at";
  /** Attributs assignables en masse. Si vide, on s'appuie sur `guarded`. */
  static fillable: string[] = [];
  static guarded: string[] = ["id"];
  /** Casting des attributs : { is_active: "boolean", meta: "json" }. */
  static casts: Record<string, CastType> = {};

  // ----------------------------------------------------- état d'instance
  protected attributes: Attributes = {};
  protected original: Attributes = {};
  protected loadedRelations: Record<string, unknown> = {};
  /** L'enregistrement existe-t-il en base ? */
  public $exists = false;

  constructor(attrs: Attributes = {}) {
    this.fill(attrs);
    // Le Proxy route les accès inconnus vers les attributs.
    return new Proxy(this, MODEL_HANDLER);
  }

  // ------------------------------------------------------------- métadonnées
  static getTable(): string {
    return this.table ?? deriveTable(this.name);
  }

  static getConnection(): Connection {
    return ConnectionManager.connection(this.connectionName);
  }

  getKeyName(): string {
    return (this.constructor as typeof Model).primaryKey;
  }

  getKey(): unknown {
    return this.attributes[this.getKeyName()];
  }

  // ------------------------------------------------------------- attributs
  fill(attrs: Attributes): this {
    for (const [key, value] of Object.entries(attrs)) {
      if (this.isFillable(key)) this.setAttribute(key, value);
    }
    return this;
  }

  forceFill(attrs: Attributes): this {
    for (const [key, value] of Object.entries(attrs)) this.setAttribute(key, value);
    return this;
  }

  protected isFillable(key: string): boolean {
    const ctor = this.constructor as typeof Model;
    if (ctor.fillable.length) return ctor.fillable.includes(key);
    return !ctor.guarded.includes(key);
  }

  getAttribute(key: string): unknown {
    const raw = this.attributes[key];
    // Accessor : getFooAttribute()
    const accessor = `get${studly(key)}Attribute`;
    if (typeof (this as any)[accessor] === "function") {
      return (this as any)[accessor](raw);
    }
    return this.castGet(key, raw);
  }

  setAttribute(key: string, value: unknown): this {
    const mutator = `set${studly(key)}Attribute`;
    if (typeof (this as any)[mutator] === "function") {
      const result = (this as any)[mutator](value);
      if (result !== undefined) this.attributes[key] = result;
      return this;
    }
    this.attributes[key] = value;
    return this;
  }

  protected castGet(key: string, value: unknown): unknown {
    if (value === null || value === undefined) return value;
    const cast = (this.constructor as typeof Model).casts[key];
    switch (cast) {
      case "int":
        return Number(value);
      case "float":
        return Number(value);
      case "boolean":
        return Boolean(value) && value !== 0 && value !== "0";
      case "string":
        return String(value);
      case "json":
        return typeof value === "string" ? JSON.parse(value) : value;
      case "date":
      case "datetime":
        return value instanceof Date ? value : new Date(String(value));
      default:
        return value;
    }
  }

  /** Sérialise les attributs pour l'écriture en base (json -> string, etc.). */
  protected attributesForStorage(attrs: Attributes): Attributes {
    const casts = (this.constructor as typeof Model).casts;
    const out: Attributes = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (casts[key] === "json" && value !== null && typeof value !== "string") {
        out[key] = JSON.stringify(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  // ------------------------------------------------------------ dirty state
  isDirty(): boolean {
    return this.getDirty() !== null;
  }

  /** Renvoie les attributs modifiés depuis le dernier sync, ou null. */
  getDirty(): Attributes | null {
    const dirty: Attributes = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (this.original[key] !== value) dirty[key] = value;
    }
    return Object.keys(dirty).length ? dirty : null;
  }

  protected syncOriginal(): void {
    this.original = { ...this.attributes };
  }

  // --------------------------------------------------------------- requêtes
  static query<T extends Model>(this: ModelCtor<T>): ModelQueryBuilder<T> {
    const conn = (this as typeof Model).getConnection();
    return new ModelQueryBuilder<T>(conn, conn.getGrammar(), this).from(
      (this as typeof Model).getTable()
    );
  }

  static all<T extends Model>(this: ModelCtor<T>): Promise<import("./Collection.js").Collection<T>> {
    return (this as any).query().get();
  }

  static async find<T extends Model>(this: ModelCtor<T>, id: unknown): Promise<T | null> {
    return (this as any).query().where((this as typeof Model).primaryKey, id).first();
  }

  static async findOrFail<T extends Model>(this: ModelCtor<T>, id: unknown): Promise<T> {
    const model = await (this as any).find(id);
    if (!model) throw new Error(`${(this as typeof Model).name} #${String(id)} introuvable.`);
    return model;
  }

  static where<T extends Model>(
    this: ModelCtor<T>,
    column: string,
    operatorOrValue: unknown,
    value?: unknown
  ): ModelQueryBuilder<T> {
    const q = (this as any).query() as ModelQueryBuilder<T>;
    return value === undefined ? q.where(column, operatorOrValue) : q.where(column, operatorOrValue as any, value);
  }

  static with<T extends Model>(this: ModelCtor<T>, ...relations: string[]): ModelQueryBuilder<T> {
    return ((this as any).query() as ModelQueryBuilder<T>).with(...relations);
  }

  static async create<T extends Model>(this: ModelCtor<T>, attrs: Attributes): Promise<T> {
    const model = new this(attrs) as T;
    await model.save();
    return model;
  }

  // ----------------------------------------------------------- persistance
  async save(): Promise<this> {
    const ctor = this.constructor as typeof Model;
    const conn = ctor.getConnection();
    this.touchTimestamps();

    if (this.$exists) {
      const dirty = this.getDirty();
      if (!dirty) return this;
      await fireModelEvent(this, "updating");
      await conn
        .table(ctor.getTable())
        .where(this.getKeyName(), this.getKey())
        .update(this.attributesForStorage(dirty));
      await fireModelEvent(this, "updated");
    } else {
      await fireModelEvent(this, "creating");
      const id = await conn
        .table(ctor.getTable())
        .insertGetId(this.attributesForStorage(this.attributes));
      if (ctor.incrementing && id) this.attributes[this.getKeyName()] = id;
      this.$exists = true;
      await fireModelEvent(this, "created");
    }
    this.syncOriginal();
    return this;
  }

  async delete(): Promise<boolean> {
    if (!this.$exists) return false;
    const ctor = this.constructor as typeof Model;
    await fireModelEvent(this, "deleting");
    const affected = await ctor
      .getConnection()
      .table(ctor.getTable())
      .where(this.getKeyName(), this.getKey())
      .delete();
    this.$exists = false;
    await fireModelEvent(this, "deleted");
    return affected > 0;
  }

  async update(attrs: Attributes): Promise<this> {
    this.fill(attrs);
    return this.save();
  }

  /** Recharge l'instance depuis la base. */
  async refresh(): Promise<this> {
    const ctor = this.constructor as typeof Model;
    const fresh = await (ctor as any).find(this.getKey());
    if (fresh) {
      this.attributes = { ...fresh.getRawAttributes() };
      this.syncOriginal();
    }
    return this;
  }

  protected touchTimestamps(): void {
    const ctor = this.constructor as typeof Model;
    if (!ctor.timestamps) return;
    const now = new Date().toISOString();
    if (!this.$exists) this.attributes[ctor.createdAtColumn] ??= now;
    this.attributes[ctor.updatedAtColumn] = now;
  }

  // --------------------------------------------------------------- relations
  hasMany<R extends Model>(related: ModelCtor<R>, foreignKey?: string, localKey?: string): HasMany<R> {
    const ctor = this.constructor as typeof Model;
    return new HasMany<R>(
      related,
      this,
      foreignKey ?? deriveFk(ctor.name),
      localKey ?? ctor.primaryKey
    );
  }

  hasOne<R extends Model>(related: ModelCtor<R>, foreignKey?: string, localKey?: string): HasOne<R> {
    const ctor = this.constructor as typeof Model;
    return new HasOne<R>(
      related,
      this,
      foreignKey ?? deriveFk(ctor.name),
      localKey ?? ctor.primaryKey
    );
  }

  belongsTo<R extends Model>(related: ModelCtor<R>, foreignKey?: string, ownerKey?: string): BelongsTo<R> {
    return new BelongsTo<R>(
      related,
      this,
      foreignKey ?? deriveFk(related.name),
      ownerKey ?? related.primaryKey
    );
  }

  setRelation(name: string, value: unknown): void {
    this.loadedRelations[name] = value;
  }

  getRelation<T = unknown>(name: string): T {
    return this.loadedRelations[name] as T;
  }

  relationLoaded(name: string): boolean {
    return name in this.loadedRelations;
  }

  /** Charge paresseusement une relation et la mémorise. */
  async load(name: string): Promise<this> {
    const relation = (this as any)[name]?.();
    if (relation && typeof relation.getResults === "function") {
      this.setRelation(name, await relation.getResults());
    }
    return this;
  }

  // ------------------------------------------------------------ hydratation
  /** Crée une instance depuis une ligne brute de la base (déjà persistée). */
  static hydrate<T extends Model>(this: ModelCtor<T>, row: Attributes): T {
    const model = new this() as T;
    model.setRawAttributes(row, true);
    return model;
  }

  setRawAttributes(attrs: Attributes, exists = false): this {
    this.attributes = { ...attrs };
    this.$exists = exists;
    this.syncOriginal();
    return this;
  }

  getRawAttributes(): Attributes {
    return this.attributes;
  }

  // ------------------------------------------------------------- sérialisation
  toObject(): Attributes {
    const out: Attributes = {};
    for (const key of Object.keys(this.attributes)) out[key] = this.getAttribute(key);
    for (const [name, value] of Object.entries(this.loadedRelations)) {
      out[name] = value && typeof (value as any).toJSON === "function" ? (value as any).toJSON() : value;
    }
    return out;
  }

  toJSON(): Attributes {
    return this.toObject();
  }
}

/** Champs internes à ne jamais traiter comme des attributs. */
const RESERVED = new Set([
  "attributes",
  "original",
  "loadedRelations",
  "$exists",
]);

/** Handler de Proxy : route les accès inconnus vers get/setAttribute. */
const MODEL_HANDLER: ProxyHandler<Model> = {
  get(target, prop, receiver) {
    if (typeof prop === "symbol" || prop in target || RESERVED.has(prop)) {
      return Reflect.get(target, prop, receiver);
    }
    // Attribut connu ?
    if (prop in (target as any).attributes) {
      return (target as any).getAttribute(prop);
    }
    // Accessor calculé sans attribut stocké (getXxxAttribute) ?
    if (typeof (target as any)[`get${studly(prop)}Attribute`] === "function") {
      return (target as any).getAttribute(prop);
    }
    return undefined;
  },
  set(target, prop, value, receiver) {
    if (typeof prop === "symbol" || RESERVED.has(prop) || prop in Object.getPrototypeOf(target)) {
      return Reflect.set(target, prop, value, receiver);
    }
    (target as any).setAttribute(prop as string, value);
    return true;
  },
  has(target, prop) {
    if (typeof prop !== "symbol" && prop in (target as any).attributes) return true;
    return Reflect.has(target, prop);
  },
};

export type { ModelCtor, ModelEvent };
