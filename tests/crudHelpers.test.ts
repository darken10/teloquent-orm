import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema } from "../src/index.js";

class User extends Model {
  static override fillable = ["name", "email", "votes"];
  declare id: number;
  declare name: string;
  declare email: string;
  declare votes: number;
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

dd("Helpers CRUD", () => {
  beforeAll(async () => {
    await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
    await Schema().create("users", (t) => {
      t.increments("id");
      t.string("name");
      t.string("email").unique();
      t.integer("votes").default(0);
      t.timestamps();
    });
  });

  afterAll(async () => {
    await ConnectionManager.closeAll();
  });

  it("firstOrCreate : crée puis retrouve sans doublon", async () => {
    const u1 = await User.firstOrCreate({ email: "z@a.com" }, { name: "Zoumana" });
    expect(u1.id).toBeGreaterThan(0);
    const u2 = await User.firstOrCreate({ email: "z@a.com" }, { name: "Autre" });
    expect(u2.id).toBe(u1.id);
    expect(u2.name).toBe("Zoumana");
    expect(await User.query().count()).toBe(1);
  });

  it("firstOrNew : instance non persistée", async () => {
    const n = await User.firstOrNew({ email: "new@a.com" }, { name: "New" });
    expect((n as any).$exists).toBe(false);
    expect(n.name).toBe("New");
  });

  it("updateOrCreate : met à jour ou crée", async () => {
    const up = await User.updateOrCreate({ email: "z@a.com" }, { name: "Zoumana T." });
    expect(up.name).toBe("Zoumana T.");
    const created = await User.updateOrCreate({ email: "awa@a.com" }, { name: "Awa" });
    expect(created.name).toBe("Awa");
    expect(await User.query().count()).toBe(2);
  });

  it("increment / decrement (instance + masse)", async () => {
    const u = await User.where("email", "z@a.com").first();
    await u!.increment("votes", 5);
    expect(u!.votes).toBe(5);
    expect(Number((await User.find(u!.id))!.votes)).toBe(5);
    await u!.decrement("votes", 2);
    expect(u!.votes).toBe(3);

    await User.query().increment("votes", 10);
    const all = await User.query().get();
    expect(all.every((x) => Number(x.votes) >= 10)).toBe(true);
  });

  it("upsert : met à jour l'existant et insère le nouveau", async () => {
    await User.upsert(
      [
        { email: "z@a.com", name: "ZUP", votes: 99 },
        { email: "brand@a.com", name: "Brand", votes: 1 },
      ],
      ["email"],
      ["name", "votes"]
    );
    const zup = await User.where("email", "z@a.com").first();
    expect(zup!.name).toBe("ZUP");
    expect(Number(zup!.votes)).toBe(99);
    const brand = await User.where("email", "brand@a.com").first();
    expect(brand!.name).toBe("Brand");
  });
});
