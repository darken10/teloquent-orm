import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema, Collection } from "../src/index.js";

class Comment extends Model {
  static override fillable = ["body", "post_id"];
  declare id: number;
  declare body: string;
}
class Tag extends Model {
  static override fillable = ["name"];
  declare id: number;
  declare name: string;
}
class Post extends Model {
  static override fillable = ["title", "user_id"];
  declare id: number;
  declare title: string;
  comments() {
    return this.hasMany(Comment);
  }
  tags() {
    return this.belongsToMany(Tag);
  }
}
class User extends Model {
  static override fillable = ["name"];
  declare id: number;
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

dd("Eager loading imbriqué + withCount", () => {
  let user: User;
  let p1: Post;
  let p2: Post;

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
      t.timestamps();
    });
    await Schema().create("comments", (t) => {
      t.increments("id");
      t.string("body");
      t.foreignId("post_id");
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

    user = await User.create({ name: "Zoumana" });
    p1 = await Post.create({ title: "P1", user_id: user.id });
    p2 = await Post.create({ title: "P2", user_id: user.id });
    await Comment.create({ body: "c1", post_id: p1.id });
    await Comment.create({ body: "c2", post_id: p1.id });
    await Comment.create({ body: "c3", post_id: p2.id });
    const t1 = await Tag.create({ name: "red" });
    const t2 = await Tag.create({ name: "blue" });
    await p1.tags().attach([t1.id, t2.id]);
  });

  afterAll(async () => {
    await ConnectionManager.closeAll();
  });

  it("with imbriqué : posts.comments", async () => {
    const users = await User.with("posts.comments").get();
    const posts = users.first()!.getRelation<Collection<Post>>("posts");
    expect(posts.length).toBe(2);
    const total = posts.reduce((s, p) => s + p.getRelation<Collection<Comment>>("comments").length, 0);
    expect(total).toBe(3);
  });

  it("with imbriqué : posts.tags (N-N)", async () => {
    const users = await User.with("posts.tags").get();
    const loadedP1 = users.first()!.getRelation<Collection<Post>>("posts").find((x) => x.id === p1.id)!;
    expect(loadedP1.getRelation<Collection<Tag>>("tags").length).toBe(2);
  });

  it("withCount : hasMany", async () => {
    const posts = await Post.query().withCount("comments").get();
    expect(posts.find((x) => x.id === p1.id)!.getAttribute("comments_count")).toBe(2);
    expect(posts.find((x) => x.id === p2.id)!.getAttribute("comments_count")).toBe(1);
  });

  it("withCount : belongsToMany", async () => {
    const posts = await Post.query().withCount("tags").get();
    expect(posts.find((x) => x.id === p1.id)!.getAttribute("tags_count")).toBe(2);
    expect(posts.find((x) => x.id === p2.id)!.getAttribute("tags_count")).toBe(0);
  });

  it("withCount apparaît dans toJSON", async () => {
    const posts = await Post.query().withCount("comments").get();
    expect((posts.find((x) => x.id === p1.id)!.toJSON() as any).comments_count).toBe(2);
  });
});
