import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema, Collection } from "../src/index.js";

// ----------------------------------------------------------------- modèles
class User extends Model {
  static override casts = { is_active: "boolean" as const, meta: "json" as const };
  static override fillable = ["name", "email", "is_active", "meta"];

  declare id: number;
  declare name: string;
  declare email: string;
  declare is_active: boolean;
  declare meta: Record<string, unknown> | null;

  posts() {
    return this.hasMany(Post);
  }
  getDisplayNameAttribute(): string {
    return `★ ${this.getAttribute("name")}`;
  }
}

class Post extends Model {
  static override fillable = ["title", "user_id"];
  declare id: number;
  declare title: string;
  declare user_id: number;
  author() {
    return this.belongsTo(User, "user_id");
  }
}

// ------------------------------------------- détection du driver SQLite
let SQLITE_OK = true;
try {
  await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
  await ConnectionManager.connection().statement("create table _probe (a integer)");
  await ConnectionManager.closeAll();
} catch {
  SQLITE_OK = false;
}

const dd = SQLITE_OK ? describe : describe.skip;
if (!SQLITE_OK) {
  // eslint-disable-next-line no-console
  console.warn("⚠ Tests d'intégration SQLite ignorés (aucun driver SQLite disponible).");
}

dd("Model — intégration SQLite", () => {
  beforeAll(async () => {
    await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
    await Schema().create("users", (t) => {
      t.increments("id");
      t.string("name");
      t.string("email").unique();
      t.boolean("is_active").default(true);
      t.text("meta").nullable();
      t.timestamps();
    });
    await Schema().create("posts", (t) => {
      t.increments("id");
      t.string("title");
      t.foreignId("user_id");
      t.timestamps();
    });
  });

  afterAll(async () => {
    await ConnectionManager.closeAll();
  });

  it("create + find + clé auto-incrémentée", async () => {
    const u = await User.create({ name: "Inoussa ZERBO", email: "z@africasys.com" });
    expect(u.id).toBeGreaterThan(0);
    const found = await User.find(u.id);
    expect(found?.name).toBe("Inoussa ZERBO");
  });

  it("cast boolean et json", async () => {
    const u = await User.create({
      name: "Awa",
      email: "awa@africasys.com",
      is_active: false,
      meta: { city: "Ouaga", tags: [1, 2] },
    });
    const fresh = await User.find(u.id);
    expect(fresh?.is_active).toBe(false); // 0 -> false
    expect(fresh?.meta).toEqual({ city: "Ouaga", tags: [1, 2] }); // JSON parse
  });

  it("accessor getXxxAttribute", async () => {
    const u = await User.create({ name: "Idrissa", email: "id@africasys.com" });
    expect((u as any).display_name).toBe("★ Idrissa");
  });

  it("dirty tracking : update n'envoie que le modifié", async () => {
    const u = await User.create({ name: "Moussa", email: "m@africasys.com" });
    expect(u.isDirty()).toBe(false);
    u.name = "Moussa K.";
    expect(u.isDirty()).toBe(true);
    expect(u.getDirty()).toMatchObject({ name: "Moussa K." });
    await u.save();
    expect(u.isDirty()).toBe(false);
    const fresh = await User.find(u.id);
    expect(fresh?.name).toBe("Moussa K.");
  });

  it("where + count", async () => {
    const total = await User.query().count();
    expect(total).toBeGreaterThanOrEqual(4);
    const actifs = await User.where("is_active", true).get();
    expect(actifs.every((u) => u.is_active === true)).toBe(true);
  });

  it("hasMany — chargement lazy", async () => {
    const u = await User.create({ name: "Auteur", email: "auteur@africasys.com" });
    await Post.create({ title: "P1", user_id: u.id });
    await Post.create({ title: "P2", user_id: u.id });
    const posts = (await u.posts().getResults()) as Collection<Post>;
    expect(posts.length).toBe(2);
    expect(posts.pluck("title").sort()).toEqual(["P1", "P2"]);
  });

  it("eager loading with('posts') — pas de N+1", async () => {
    const users = await User.with("posts").get();
    for (const u of users) {
      expect(u.relationLoaded("posts")).toBe(true);
      expect(u.getRelation<Collection<Post>>("posts")).toBeInstanceOf(Array);
    }
  });

  it("belongsTo eager with('author')", async () => {
    const posts = await Post.with("author").get();
    const first = posts.first()!;
    expect(first.getRelation<User>("author")).toBeTruthy();
    expect(first.getRelation<User>("author").id).toBe(first.user_id);
  });

  it("delete", async () => {
    const u = await User.create({ name: "Temp", email: "temp@africasys.com" });
    const id = u.id;
    expect(await u.delete()).toBe(true);
    expect(await User.find(id)).toBeNull();
  });

  it("toJSON sérialise les attributs castés", async () => {
    const u = await User.create({
      name: "JSON",
      email: "json@africasys.com",
      meta: { a: 1 },
    });
    const json = u.toJSON();
    expect(json.name).toBe("JSON");
    expect(json.meta).toEqual({ a: 1 });
  });
});
