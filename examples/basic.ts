/**
 * Démo de bout en bout de Teloquent sur SQLite en mémoire.
 * Lancer :  npm run example
 */
import {
  Model,
  ConnectionManager,
  Schema,
  Collection,
  ModelEvents,
  type Attributes,
} from "../src/index.js";

// --------------------------------------------------------------- modèles

class User extends Model {
  static override casts = { is_active: "boolean" as const };

  declare id: number;
  declare name: string;
  declare email: string;
  declare is_active: boolean;

  // Relation 1-N (méthode, comme Eloquent)
  posts() {
    return this.hasMany(Post);
  }

  // Accessor : user.display_name
  getDisplayNameAttribute(): string {
    return `★ ${this.getAttribute("name")}`;
  }
}

class Post extends Model {
  declare id: number;
  declare title: string;
  declare user_id: number;

  author() {
    return this.belongsTo(User, "user_id");
  }
}

// --------------------------------------------------------------- exécution

async function main() {
  await ConnectionManager.addConnection({ driver: "sqlite", database: ":memory:" });

  // Schéma
  await Schema().create("users", (t) => {
    t.increments("id");
    t.string("name");
    t.string("email").unique();
    t.boolean("is_active").default(true);
    t.timestamps();
  });
  await Schema().create("posts", (t) => {
    t.increments("id");
    t.string("title");
    t.foreignId("user_id");
    t.timestamps();
  });

  // Event observer
  ModelEvents.on(User, "created", (u: User) => {
    console.log(`  [event] User créé : ${u.getAttribute("name")} (#${u.getKey()})`);
  });

  // --- CREATE
  console.log("\n# Création");
  const zoumana = await User.create({ name: "Zoumana", email: "z@africasys.com" });
  const awa = await User.create({ name: "Awa", email: "awa@africasys.com", is_active: false });

  await Post.create({ title: "Premier post", user_id: zoumana.id });
  await Post.create({ title: "Deuxième post", user_id: zoumana.id });
  await Post.create({ title: "Post de Awa", user_id: awa.id });

  // --- READ
  console.log("\n# Lecture");
  const all = await User.all();
  console.log(`  Utilisateurs : ${all.pluck("name").join(", ")}`);

  const found = await User.find(zoumana.id);
  console.log(`  find(${zoumana.id}) -> ${found?.name}`);
  console.log(`  accessor display_name -> ${(found as any).getAttribute("display_name") ?? (found as any).display_name}`);

  const actifs = await User.where("is_active", true).get();
  console.log(`  Actifs : ${actifs.pluck("name").join(", ")}`);

  // --- AGGREGATES
  console.log("\n# Agrégats");
  console.log(`  count posts = ${await Post.query().count()}`);

  // --- UPDATE
  console.log("\n# Mise à jour");
  zoumana.name = "Zoumana TRAORE";
  console.log(`  isDirty avant save = ${zoumana.isDirty()}`);
  await zoumana.save();
  console.log(`  isDirty après save = ${zoumana.isDirty()}`);

  // --- RELATIONS (lazy)
  console.log("\n# Relations (lazy)");
  const posts = (await zoumana.posts().getResults()) as Collection<Post>;
  console.log(`  posts de Zoumana : ${posts.pluck("title").join(", ")}`);

  // --- EAGER LOADING (évite le N+1)
  console.log("\n# Eager loading (with)");
  const usersWithPosts = await User.with("posts").get();
  for (const u of usersWithPosts) {
    const ps = u.getRelation<Collection<Post>>("posts");
    console.log(`  ${u.name} -> ${ps.length} post(s) : ${ps.pluck("title").join(" | ")}`);
  }

  // --- belongsTo eager
  const postsWithAuthor = await Post.with("author").get();
  const first = postsWithAuthor.first()!;
  console.log(`  "${first.title}" écrit par ${first.getRelation<User>("author")?.name}`);

  // --- toJSON
  console.log("\n# Sérialisation");
  console.log("  ", JSON.stringify(found?.toJSON()));

  // --- DELETE
  console.log("\n# Suppression");
  await awa.delete();
  console.log(`  count users = ${await User.query().count()}`);

  // --- toSql (debug)
  console.log("\n# SQL généré (debug)");
  console.log("  ", User.where("is_active", true).orderBy("name").toSql());

  await ConnectionManager.closeAll();
  console.log("\n✓ Démo terminée.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export type { Attributes };
