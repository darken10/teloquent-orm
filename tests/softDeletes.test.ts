import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema } from "../src/index.js";

// ------------------------------------------------------------------ modèles
class Article extends Model {
  static override softDeletes = true;
  static override fillable = ["title", "published"];
  static override casts = { published: "boolean" as const };

  declare id: number;
  declare title: string;
  declare published: boolean;

  // scope local : Article.scope("published")
  static scopePublished(q: any) {
    q.where("published", true);
  }
}

class Tenant extends Model {
  static override timestamps = false;
  static override fillable = ["name", "active"];
  static override casts = { active: "boolean" as const };
  declare id: number;
  declare name: string;
  declare active: boolean;
}
// scope global : toujours filtrer les inactifs
Tenant.addGlobalScope("active", (q) => q.where("active", true));

// --------------------------------------------- détection du driver SQLite
let SQLITE_OK = true;
try {
  await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
  await ConnectionManager.connection().statement("create table _probe (a integer)");
  await ConnectionManager.closeAll();
} catch {
  SQLITE_OK = false;
}
const dd = SQLITE_OK ? describe : describe.skip;

dd("Soft deletes & scopes", () => {
  beforeAll(async () => {
    await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
    await Schema().create("articles", (t) => {
      t.increments("id");
      t.string("title");
      t.boolean("published").default(false);
      t.timestamps();
      t.softDeletes();
    });
    await Schema().create("tenants", (t) => {
      t.increments("id");
      t.string("name");
      t.boolean("active").default(true);
    });
  });

  afterAll(async () => {
    await ConnectionManager.closeAll();
  });

  it("delete() est un soft delete : la ligne est cachée mais présente", async () => {
    const a = await Article.create({ title: "À supprimer", published: true });
    expect(await Article.query().count()).toBe(1);

    await a.delete();
    expect(a.trashed()).toBe(true);
    expect(await Article.query().count()).toBe(0); // caché par défaut
    expect(await Article.find(a.id)).toBeNull(); // find ignore les trashed
    expect(await Article.withTrashed().count()).toBe(1); // toujours en base
  });

  it("onlyTrashed() ne renvoie que les supprimés", async () => {
    await Article.create({ title: "Vivant" });
    const trashed = await Article.onlyTrashed().get();
    expect(trashed.length).toBe(1);
    expect(trashed.first()!.title).toBe("À supprimer");
  });

  it("restore() réactive l'enregistrement", async () => {
    const a = await Article.withTrashed().where("title", "À supprimer").first();
    expect(a!.trashed()).toBe(true);
    await a!.restore();
    expect(a!.trashed()).toBe(false);
    expect(await Article.query().count()).toBe(2); // de nouveau visible
  });

  it("forceDelete() supprime réellement", async () => {
    const a = await Article.create({ title: "Définitif" });
    await a.forceDelete();
    expect(await Article.withTrashed().where("title", "Définitif").first()).toBeNull();
  });

  it("scope local : scopePublished", async () => {
    // état actuel : "À supprimer" (published=true) et "Vivant" (published=false)
    const published = await Article.scope("published").get();
    expect(published.every((x) => x.published === true)).toBe(true);
    expect(published.map((x) => x.title)).toContain("À supprimer");
    expect(published.map((x) => x.title)).not.toContain("Vivant");
  });

  it("scope global : appliqué automatiquement à toutes les requêtes", async () => {
    await Tenant.create({ name: "Actif", active: true });
    await Tenant.create({ name: "Inactif", active: false });

    const all = await Tenant.query().get();
    expect(all.length).toBe(1);
    expect(all.first()!.name).toBe("Actif");

    // visible dans le SQL généré
    const { sql, bindings } = Tenant.query().toSql();
    expect(sql).toContain('"active" = ?');
    expect(bindings).toContain(true);
  });

  it("soft delete : SQL par défaut filtre deleted_at is null", () => {
    const { sql } = Article.query().toSql();
    expect(sql).toContain('"deleted_at" is null');
  });
});
