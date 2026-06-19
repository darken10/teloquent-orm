import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema } from "../src/index.js";

class Post extends Model {
  static override softDeletes = true;
  static override fillable = ["title"];
  declare id: number;
  declare title: string;
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

dd("Pagination & chunk", () => {
  beforeAll(async () => {
    await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
    await Schema().create("posts", (t) => {
      t.increments("id");
      t.string("title");
      t.timestamps();
      t.softDeletes();
    });
    for (let i = 1; i <= 23; i++) await Post.create({ title: `P${i}` });
    // soft delete 3 -> 20 visibles
    for (const id of [1, 2, 3]) (await Post.find(id))!.delete();
  });

  afterAll(async () => {
    await ConnectionManager.closeAll();
  });

  it("paginate : total exclut les soft-deleted", async () => {
    const p = await Post.query().paginate(1, 10);
    expect(p.total).toBe(20);
    expect(p.lastPage).toBe(2);
    expect(p.data.length).toBe(10);
    expect(p.currentPage).toBe(1);
    expect(p.from).toBe(1);
    expect(p.to).toBe(10);
  });

  it("paginate : page intermédiaire et page vide", async () => {
    const p2 = await Post.query().paginate(2, 10);
    expect(p2.data.length).toBe(10);
    expect(p2.from).toBe(11);
    expect(p2.to).toBe(20);

    const p3 = await Post.query().paginate(3, 10);
    expect(p3.data.length).toBe(0);
  });

  it("simplePaginate : hasMore", async () => {
    const sp1 = await Post.query().simplePaginate(1, 10);
    expect(sp1.data.length).toBe(10);
    expect(sp1.hasMore).toBe(true);

    const sp2 = await Post.query().simplePaginate(2, 10);
    expect(sp2.data.length).toBe(10);
    expect(sp2.hasMore).toBe(false);
  });

  it("forPage", async () => {
    const rows = await Post.query().forPage(2, 5).get();
    expect(rows.length).toBe(5);
  });

  it("chunk : parcourt tout en lots", async () => {
    let seen = 0;
    let batches = 0;
    await Post.query().chunk(7, (rows) => {
      seen += rows.length;
      batches++;
    });
    expect(seen).toBe(20);
    expect(batches).toBe(3); // 7 + 7 + 6
  });

  it("paginate combinable avec where", async () => {
    const p = await Post.query().where("title", "like", "P1%").paginate(1, 5);
    expect(p.total).toBeGreaterThan(0);
    expect(p.data.every((x) => x.title.startsWith("P1"))).toBe(true);
  });
});
