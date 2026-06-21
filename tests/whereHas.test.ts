import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema } from "../src/index.js";

class Tag extends Model {
  static override fillable = ["name"];
  declare id: number;
  declare name: string;
}
class Post extends Model {
  static override fillable = ["title", "user_id", "published"];
  static override casts = { published: "boolean" as const };
  declare id: number;
  declare title: string;
  declare published: boolean;
  tags() {
    return this.belongsToMany(Tag);
  }
}
class User extends Model {
  static override fillable = ["name"];
  declare id: number;
  declare name: string;
  posts() {
    return this.hasMany(Post);
  }
}

let SQLITE_OK = true;
try {
  await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
  await ConnectionManager.connection().statement("create table _probe (a integer)");
  await ConnectionManager.closeAll();
} catch {
  SQLITE_OK = false;
}
const dd = SQLITE_OK ? describe : describe.skip;

dd("whereHas / has / doesntHave + where imbriqué", () => {
  beforeAll(async () => {
    await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });
    await Schema().create("users", (t) => {
      t.increments("id");
      t.string("name");
      t.timestamps();
    });
    await Schema().create("posts", (t) => {
      t.increments("id");
      t.string("title");
      t.foreignId("user_id");
      t.boolean("published").default(false);
      t.timestamps();
    });
    await Schema().create("tags", (t) => {
      t.increments("id");
      t.string("name");
      t.timestamps();
    });
    await Schema().create("post_tag", (t) => {
      t.foreignId("post_id");
      t.foreignId("tag_id");
    });

    const u1 = await User.create({ name: "AvecPosts" });
    await User.create({ name: "SansPosts" });
    const u3 = await User.create({ name: "AvecBrouillon" });
    const p1 = await Post.create({ title: "P1", user_id: u1.id, published: true });
    await Post.create({ title: "P2", user_id: u3.id, published: false });
    const red = await Tag.create({ name: "red" });
    await p1.tags().attach(red.id);
  });

  afterAll(async () => {
    await ConnectionManager.closeAll();
  });

  it("has : existence d'une relation", async () => {
    const users = await User.query().has("posts").get();
    expect(users.pluck("name").sort()).toEqual(["AvecBrouillon", "AvecPosts"]);
  });

  it("doesntHave : absence d'une relation", async () => {
    const users = await User.query().doesntHave("posts").get();
    expect(users.length).toBe(1);
    expect(users.first()!.name).toBe("SansPosts");
  });

  it("whereHas avec contrainte", async () => {
    const users = await User.query()
      .whereHas("posts", (q) => q.where("published", true))
      .get();
    expect(users.length).toBe(1);
    expect(users.first()!.name).toBe("AvecPosts");
  });

  it("whereHas sur une relation N-N", async () => {
    const posts = await Post.query()
      .whereHas("tags", (q) => q.where("name", "red"))
      .get();
    expect(posts.length).toBe(1);
    expect(posts.first()!.title).toBe("P1");
  });

  it("where imbriqué (closure)", async () => {
    const posts = await Post.query()
      .where((q) => q.where("published", true).orWhere("title", "P2"))
      .get();
    expect(posts.length).toBe(2);
  });
});
