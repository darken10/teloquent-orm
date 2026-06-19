import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema, Collection } from "../src/index.js";

// ------------------------------------------------------------------ modèles
class Role extends Model {
  static override fillable = ["name"];
  declare id: number;
  declare name: string;
}

class Permission extends Model {
  static override timestamps = false;
  static override fillable = ["name"];
  declare id: number;
  declare name: string;
}

class User extends Model {
  static override fillable = ["name"];
  declare id: number;
  declare name: string;
  roles() {
    return this.belongsToMany(Role); // pivot déduit : role_user
  }
  permissions() {
    return this.belongsToMany(Permission); // pivot : permission_user (+ colonne granted)
  }
}

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

dd("belongsToMany (N-N)", () => {
  let user: User;
  let admin: Role;
  let editor: Role;
  let viewer: Role;

  beforeAll(async () => {
    await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
    await Schema().create("users", (t) => {
      t.increments("id");
      t.string("name");
      t.timestamps();
    });
    await Schema().create("roles", (t) => {
      t.increments("id");
      t.string("name");
      t.timestamps();
    });
    await Schema().create("role_user", (t) => {
      t.foreignId("user_id");
      t.foreignId("role_id");
    });
    await Schema().create("permissions", (t) => {
      t.increments("id");
      t.string("name");
    });
    await Schema().create("permission_user", (t) => {
      t.foreignId("user_id");
      t.foreignId("permission_id");
      t.boolean("granted").default(true);
    });

    user = await User.create({ name: "Zoumana" });
    admin = await Role.create({ name: "admin" });
    editor = await Role.create({ name: "editor" });
    viewer = await Role.create({ name: "viewer" });
  });

  afterAll(async () => {
    await ConnectionManager.closeAll();
  });

  it("attach + getResults", async () => {
    await user.roles().attach([admin.id, editor.id]);
    const roles = await user.roles().getResults();
    expect(roles.length).toBe(2);
    expect(roles.pluck("name").sort()).toEqual(["admin", "editor"]);
  });

  it("eager loading with('roles')", async () => {
    const users = await User.with("roles").get();
    const roles = users.first()!.getRelation<Collection<Role>>("roles");
    expect(roles.length).toBe(2);
    // la clé pivot technique est nettoyée des attributs
    expect((roles.first() as any).getRawAttributes().__pivot_fk__).toBeUndefined();
  });

  it("detach d'une liaison", async () => {
    await user.roles().detach(admin.id);
    const roles = await user.roles().getResults();
    expect(roles.length).toBe(1);
    expect(roles.first()!.name).toBe("editor");
  });

  it("sync remplace l'ensemble des liaisons", async () => {
    await user.roles().sync([viewer.id, admin.id]);
    const roles = await user.roles().get();
    expect(roles.pluck("name").sort()).toEqual(["admin", "viewer"]);
  });

  it("where sur la relation", async () => {
    const found = await user.roles().where("name", "admin").get();
    expect(found.length).toBe(1);
    expect(found.first()!.name).toBe("admin");
  });

  it("attach avec données pivot supplémentaires", async () => {
    const edit = await Permission.create({ name: "edit" });
    await user.permissions().attach(edit.id, { granted: false });

    const perms = await user.permissions().getResults();
    expect(perms.pluck("name")).toEqual(["edit"]);

    // la colonne pivot supplémentaire est bien écrite
    const pivotRow = await ConnectionManager.connection()
      .table("permission_user")
      .where("user_id", user.id)
      .first();
    expect(pivotRow).toMatchObject({ permission_id: edit.id, granted: 0 });
  });
});
