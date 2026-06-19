import { ConnectionManager, Schema } from "teloquent";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Surchargeable via DB_PATH (ex. ":memory:" ou un chemin local).
const DB_PATH = process.env.DB_PATH ?? join(__dirname, "..", "playground.sqlite");

let connected = false;

/** Ouvre la connexion SQLite (idempotent). */
export async function connect(): Promise<void> {
  if (connected) return;
  await ConnectionManager.addConnection({ driver: "sqlite", database: DB_PATH });
  connected = true;
}

/** (Re)crée les tables. */
export async function migrate(): Promise<void> {
  await connect();
  await Schema().dropIfExists("posts");
  await Schema().dropIfExists("users");

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
    t.text("body").nullable();
    t.foreignId("user_id");
    t.timestamps();
  });

  console.log("✓ Migration terminée");
}

/** Insère des données d'exemple. */
export async function seed(): Promise<void> {
  await connect();
  const { User } = await import("./models/User.js");
  const { Post } = await import("./models/Post.js");

  const zoumana = await User.create({ name: "Zoumana", email: "z@africasys.com" });
  const awa = await User.create({ name: "Awa", email: "awa@africasys.com", is_active: false });

  await Post.create({ title: "Bienvenue", body: "Premier article.", user_id: zoumana.id });
  await Post.create({ title: "Teloquent", body: "Un ORM maison.", user_id: zoumana.id });
  await Post.create({ title: "Notes", body: "Article d'Awa.", user_id: awa.id });

  console.log("✓ Seed terminé");
}

/** migrate + seed. */
export async function fresh(): Promise<void> {
  await migrate();
  await seed();
}

// ---- CLI : tsx src/db.ts <migrate|seed|fresh>
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const cmd = process.argv[2] ?? "fresh";
  const run = { migrate, seed, fresh }[cmd as "migrate" | "seed" | "fresh"];
  if (!run) {
    console.error(`Commande inconnue: ${cmd}. Utilisez migrate | seed | fresh.`);
    process.exit(1);
  }
  run()
    .then(() => ConnectionManager.closeAll())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
