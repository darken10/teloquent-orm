import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Model, ConnectionManager, Schema, Collection } from "../src/index.js";
import { testConfig, testDialect, probeConnection } from "./helpers/db.js";

/**
 * Suite d'intégration **cross-dialecte**. Rejoue les chemins critiques sur le
 * dialecte choisi par TELOQUENT_DIALECT (sqlite par défaut, sinon mysql/pgsql).
 *   npm run test:pg     # PostgreSQL
 *   npm run test:mysql  # MySQL
 */

class Role extends Model {
  static override fillable = ["name"];
  declare id: number;
  declare name: string;
}

class User extends Model {
  static override softDeletes = true;
  static override fillable = ["name", "email", "votes"];
  declare id: number;
  declare name: string;
  declare email: string;
  declare votes: number;
  posts() {
    return this.hasMany(Post);
  }
  roles() {
    return this.belongsToMany(Role);
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

const AVAILABLE = await probeConnection();
const dd = AVAILABLE ? describe : describe.skip;
if (!AVAILABLE) {
  console.warn(`⚠ Dialecte "${testDialect()}" indisponible — tests cross-dialecte ignorés.`);
}

dd(`Cross-dialecte [${testDialect()}]`, () => {
  beforeAll(async () => {
    await ConnectionManager.addConnection(testConfig());
    // Ordre de drop = inverse des dépendances.
    for (const t of ["role_user", "posts", "roles", "users"]) await Schema().dropIfExists(t);

    await Schema().create("users", (t) => {
      t.increments("id");
      t.string("name");
      t.string("email").unique();
      t.integer("votes").default(0);
      t.timestamps();
      t.softDeletes();
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
    await Schema().create("posts", (t) => {
      t.increments("id");
      t.string("title");
      t.foreignId("user_id");
      t.timestamps();
    });
  });

  afterAll(async () => {
    for (const t of ["role_user", "posts", "roles", "users"]) await Schema().dropIfExists(t);
    await ConnectionManager.closeAll();
  });

  it("create récupère la clé générée", async () => {
    const u = await User.create({ name: "Inoussa ZERBO", email: "z@a.com" });
    expect(typeof u.id).toBe("number");
    expect(u.id).toBeGreaterThan(0);
  });

  it("where + first", async () => {
    const u = await User.where("email", "z@a.com").first();
    expect(u?.name).toBe("Inoussa ZERBO");
  });

  it("hasMany eager + belongsTo eager", async () => {
    const u = await User.where("email", "z@a.com").first();
    await Post.create({ title: "P1", user_id: u!.id });
    await Post.create({ title: "P2", user_id: u!.id });

    const withPosts = await User.with("posts").get();
    expect(withPosts.find((x) => x.id === u!.id)!.getRelation<Collection<Post>>("posts").length).toBe(2);

    const posts = await Post.with("author").get();
    expect(posts.first()!.getRelation<User>("author").id).toBe(u!.id);
  });

  it("belongsToMany attach + get", async () => {
    const u = await User.where("email", "z@a.com").first();
    const admin = await Role.create({ name: "admin" });
    await u!.roles().attach(admin.id);
    const roles = await u!.roles().getResults();
    expect(roles.pluck("name")).toEqual(["admin"]);
  });

  it("increment en masse", async () => {
    await User.query().increment("votes", 5);
    const u = await User.where("email", "z@a.com").first();
    expect(Number(u!.votes)).toBe(5);
  });

  it("upsert (on conflict / on duplicate key)", async () => {
    await User.upsert(
      [
        { email: "z@a.com", name: "ZUP", votes: 9 },
        { email: "new@a.com", name: "New", votes: 1 },
      ],
      ["email"],
      ["name", "votes"]
    );
    expect((await User.where("email", "z@a.com").first())!.name).toBe("ZUP");
    expect((await User.where("email", "new@a.com").first())!.name).toBe("New");
  });

  it("soft delete : caché par défaut, retrouvé avec withTrashed", async () => {
    const u = await User.where("email", "new@a.com").first();
    await u!.delete();
    expect(await User.find(u!.id)).toBeNull();
    expect(await User.withTrashed().where("id", u!.id).first()).not.toBeNull();
  });

  it("pagination", async () => {
    const page = await User.query().paginate(1, 2);
    expect(page.perPage).toBe(2);
    expect(page.data.length).toBeLessThanOrEqual(2);
    expect(page.total).toBeGreaterThanOrEqual(1);
  });
});
