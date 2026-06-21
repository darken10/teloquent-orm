import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Model, ConnectionManager, Schema, Migrator, type MigrationEntry } from "../src/index.js";

const migrations: MigrationEntry[] = [
  {
    name: "001_create_users",
    async up() {
      await Schema().create("users", (t) => {
        t.increments("id");
        t.string("name");
      });
    },
    async down() {
      await Schema().dropIfExists("users");
    },
  },
  {
    name: "002_create_posts",
    async up() {
      await Schema().create("posts", (t) => {
        t.increments("id");
        t.string("title");
      });
    },
    async down() {
      await Schema().dropIfExists("posts");
    },
  },
];

let SQLITE_OK = true;
try {
  await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
  await ConnectionManager.connection().statement("create table _probe (a integer)");
  await ConnectionManager.closeAll();
} catch {
  SQLITE_OK = false;
}
const dd = SQLITE_OK ? describe : describe.skip;

dd("Migrator + Schema().table()", () => {
  beforeEach(async () => {
    await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
  });
  afterEach(async () => {
    await ConnectionManager.closeAll();
  });

  it("run applique les migrations en attente puis est idempotent", async () => {
    const m = new Migrator();
    expect((await m.run(migrations)).length).toBe(2);
    expect((await m.run(migrations)).length).toBe(0);
  });

  it("status reflète l'état", async () => {
    const m = new Migrator();
    await m.run([migrations[0]]);
    const st = await m.status(migrations);
    expect(st[0].ran).toBe(true);
    expect(st[0].batch).toBe(1);
    expect(st[1].ran).toBe(false);
  });

  it("batches distincts + rollback du dernier batch seulement", async () => {
    const m = new Migrator();
    await m.run([migrations[0]]); // batch 1
    await m.run(migrations); // batch 2 (posts)
    const reverted = await m.rollback(migrations);
    expect(reverted).toEqual(["002_create_posts"]);
    const st = await m.status(migrations);
    expect(st[0].ran).toBe(true);
    expect(st[1].ran).toBe(false);
  });

  it("reset annule tout, refresh recrée", async () => {
    const m = new Migrator();
    await m.run(migrations);
    const reset = await m.reset(migrations);
    expect(reset.length).toBe(2);
    expect((await m.status(migrations)).every((s) => !s.ran)).toBe(true);
    await m.refresh(migrations);
    expect((await m.status(migrations)).every((s) => s.ran)).toBe(true);
  });

  it("Schema().table() ajoute une colonne (ALTER)", async () => {
    await Schema().create("items", (t) => {
      t.increments("id");
      t.string("label");
    });
    await Schema().table("items", (t) => {
      t.integer("qty").nullable();
    });

    class Item extends Model {
      static override timestamps = false;
      static override fillable = ["label", "qty"];
      declare label: string;
      declare qty: number;
    }
    const it = await Item.create({ label: "x", qty: 5 });
    const fresh = await Item.find(it.id);
    expect(Number(fresh!.qty)).toBe(5);
  });
});
