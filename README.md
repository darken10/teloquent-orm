# Teloquent

[![npm](https://img.shields.io/npm/v/teloquent.svg)](https://www.npmjs.com/package/teloquent)
[![CI](https://github.com/AfricaSys/teloquent/actions/workflows/ci.yml/badge.svg)](https://github.com/AfricaSys/teloquent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Dialects](https://img.shields.io/badge/SQLite%20%7C%20MySQL%20%7C%20PostgreSQL-supported-success)

Un ORM **TypeScript** Active Record inspiré de **Laravel Eloquent**, avec un typage fort et le support de **SQLite, MySQL et PostgreSQL**.

```ts
import { Model, ConnectionManager } from "teloquent";

await ConnectionManager.addConnection({ driver: "sqlite", database: "app.sqlite" });

class User extends Model {
  declare id: number;
  declare name: string;
  posts() { return this.hasMany(Post); }
}

const user = await User.create({ name: "Inoussa ZERBO" });
const users = await User.where("is_active", true).with("posts").get();
```

## Sommaire

- [Installation](#installation)
- [Connexions](#connexions)
- [Définir un modèle](#définir-un-modèle)
- [CRUD](#crud)
- [Query Builder](#query-builder)
- [Relations](#relations)
- [Eager loading & withCount](#eager-loading--withcount)
- [Soft deletes](#soft-deletes)
- [Scopes](#scopes)
- [Pagination](#pagination)
- [Helpers CRUD](#helpers-crud)
- [Sérialisation](#sérialisation)
- [Collections](#collections)
- [Schéma & migrations](#schéma--migrations)
- [Événements](#événements)
- [Multi-SGBD & tests](#multi-sgbd--tests)
- [Développement](#développement)

---

## Installation

```bash
npm install teloquent
# + le driver de votre SGBD :
npm install better-sqlite3   # SQLite (ou Node >= 22 : module natif node:sqlite en repli)
npm install pg               # PostgreSQL
npm install mysql2           # MySQL / MariaDB
```

Teloquent est en ESM, Node >= 18. Activez les décorateurs dans votre `tsconfig.json` si vous les utilisez (optionnels) :

```json
{ "compilerOptions": { "experimentalDecorators": true, "useDefineForClassFields": false } }
```

> `useDefineForClassFields: false` est requis pour que l'accès magique aux attributs (via `Proxy`) fonctionne avec les champs déclarés `declare`.

---

## Connexions

```ts
import { ConnectionManager } from "teloquent";

// SQLite
await ConnectionManager.addConnection({ driver: "sqlite", database: "app.sqlite" });

// PostgreSQL
await ConnectionManager.addConnection({
  driver: "pgsql",
  host: "127.0.0.1", port: 5432,
  username: "user", password: "secret", database: "app",
});

// MySQL — connexion nommée
await ConnectionManager.addConnection({ driver: "mysql", /* ... */ }, "reporting");

ConnectionManager.connection();           // connexion par défaut
ConnectionManager.connection("reporting"); // connexion nommée
await ConnectionManager.closeAll();
```

Transactions :

```ts
await ConnectionManager.connection().transaction(async () => {
  await User.create({ name: "A" });
  await User.create({ name: "B" });
  // rollback automatique si une exception est levée
});
```

---

## Définir un modèle

Comme Eloquent, un modèle est « schemaless » : on déclare les propriétés pour le typage (`declare`), les attributs sont stockés dynamiquement.

```ts
import { Model } from "teloquent";

class User extends Model {
  // Configuration (toutes optionnelles)
  static table = "users";            // déduit sinon : "User" -> "users"
  static primaryKey = "id";
  static timestamps = true;          // created_at / updated_at automatiques
  static fillable = ["name", "email", "is_active"];
  static casts = { is_active: "boolean", meta: "json" };

  declare id: number;
  declare name: string;
  declare email: string;
  declare is_active: boolean;

  // Accessor : user.display_name
  getDisplayNameAttribute(): string {
    return `★ ${this.getAttribute("name")}`;
  }
  // Mutator : user.email = ... (stocké en minuscules)
  setEmailAttribute(value: string) {
    return value.toLowerCase();
  }
}
```

Conventions (surchargeable) : table = pluriel snake_case du nom de classe ; clé étrangère = `<modèle>_id` ; timestamps = `created_at` / `updated_at`.

Décorateurs optionnels : `@table("...")`, `@primaryKey("...")`, `@casts({...})`, `@connection("...")`.

### Casts disponibles

`int`, `float`, `boolean`, `string`, `json`, `date`, `datetime`.

---

## CRUD

```ts
// Créer
const u = await User.create({ name: "Inoussa ZERBO", email: "z@africasys.com" });

// Lire
await User.find(1);
await User.findOrFail(1);
await User.all();
await User.where("is_active", true).get();
await User.where("email", "z@africasys.com").first();

// Mettre à jour
u.name = "Inoussa Z.";
await u.save();                 // n'envoie que les colonnes modifiées (dirty tracking)
await u.update({ name: "X" });

// Supprimer
await u.delete();

// État
u.isDirty();
u.getDirty();
u.getKey();
```

---

## Query Builder

```ts
User.query()
  .select("id", "name")
  .where("age", ">", 18)
  .orWhere("role", "admin")
  .whereIn("id", [1, 2, 3])
  .whereNull("deleted_at")
  .whereBetween("age", [18, 30])
  .whereColumn("updated_at", ">", "created_at")
  .orderBy("name", "desc")
  .limit(10)
  .offset(20);

// where imbriqué (closure) -> ( ... or ... )
User.query().where((q) => q.where("a", 1).orWhere("b", 2));

// Agrégats
await User.query().count();
await User.query().max("age");
await User.query().exists();

// Écriture en masse
await User.query().where("inactive", true).update({ status: "archived" });
await User.query().where("id", 5).delete();
await User.query().increment("votes", 2);
await User.query().decrement("stock");

// SQL généré (debug)
User.query().where("a", 1).toSql(); // { sql, bindings }
```

Toutes les valeurs sont liées en paramètres (anti-injection SQL), avec la bonne syntaxe par dialecte (`?` pour SQLite/MySQL, `$1, $2…` pour PostgreSQL).

---

## Relations

Comme Eloquent, une relation est une **méthode** du modèle.

```ts
class User extends Model {
  posts()   { return this.hasMany(Post); }
  profile() { return this.hasOne(Profile); }
  roles()   { return this.belongsToMany(Role); } // pivot "role_user" déduit
}

class Post extends Model {
  author()  { return this.belongsTo(User, "user_id"); }
}
```

Chargement paresseux et accès aux relations chargées :

```ts
const posts = await user.posts().getResults();      // lazy
await user.posts().where("published", true).get();  // requête chaînée
const loaded = user.getRelation("posts");           // après eager loading
```

### belongsToMany (N-N)

```ts
await user.roles().attach([adminId, editorId]);
await user.roles().attach(editorId, { granted: true }); // données pivot
await user.roles().detach(adminId);
await user.roles().sync([viewerId, adminId]);           // remplace l'ensemble
```

### Filtrer par relation

```ts
await User.query().has("posts").get();
await User.query().doesntHave("posts").get();
await User.query().whereHas("posts", (q) => q.where("published", true)).get();
await Post.query().whereHas("tags", (q) => q.where("name", "red")).get(); // N-N
```

---

## Eager loading & withCount

```ts
// Une requête par relation (évite le N+1)
const users = await User.with("posts").get();

// Imbriqué (récursif)
await User.with("posts.comments", "posts.tags").get();

// Compteurs sans charger la relation -> attribut <relation>_count
const posts = await Post.query().withCount("comments", "tags").get();
posts.first().getAttribute("comments_count"); // 2
```

---

## Soft deletes

```ts
class Post extends Model {
  static softDeletes = true; // utilise la colonne deleted_at
}
```

```ts
await post.delete();        // positionne deleted_at (pas de suppression réelle)
post.trashed();             // true
await post.restore();
await post.forceDelete();   // suppression réelle

await Post.query().get();            // exclut les supprimés
await Post.withTrashed().get();      // inclut les supprimés
await Post.onlyTrashed().get();      // seulement les supprimés
```

Schéma : `t.softDeletes()` ajoute la colonne `deleted_at`.

---

## Scopes

Scopes locaux :

```ts
class Post extends Model {
  static scopePublished(q) { q.where("published", true); }
}
await Post.scope("published").get();
await Post.query().scope("published").where("title", "like", "A%").get();
```

Scopes globaux (appliqués à toutes les requêtes du modèle) :

```ts
Tenant.addGlobalScope("active", (q) => q.where("active", true));
await Tenant.query().get(); // filtre "active" appliqué automatiquement
```

---

## Pagination

```ts
const page = await Post.query().paginate(1, 15);
// { data, total, perPage, currentPage, lastPage, from, to }

const simple = await Post.query().simplePaginate(1, 15);
// { data, perPage, currentPage, hasMore } — sans COUNT

await Post.query().forPage(2, 10).get();

// Traitement par lots (mémoire-efficace)
await Post.query().chunk(100, async (rows, page) => {
  for (const p of rows) { /* ... */ }
});
```

La pagination respecte les scopes et les soft deletes.

---

## Helpers CRUD

```ts
await User.firstOrNew({ email }, { name });     // instance non sauvée si absente
await User.firstOrCreate({ email }, { name });  // trouve ou crée
await User.updateOrCreate({ email }, { name }); // met à jour ou crée

await user.increment("votes", 5);
await user.decrement("votes");

// Upsert en masse (multi-dialecte : ON CONFLICT / ON DUPLICATE KEY UPDATE)
await User.upsert(
  [{ email: "a@b.com", name: "A" }, { email: "c@d.com", name: "C" }],
  ["email"],          // colonnes de conflit
  ["name"]            // colonnes à mettre à jour
);
```

---

## Sérialisation

```ts
class User extends Model {
  static hidden = ["password"];      // masqué dans toJSON()
  static visible = [];               // si non vide : liste blanche stricte
  static appends = ["display_name"]; // attribut calculé (accessor) ajouté
  getDisplayNameAttribute() { return `★ ${this.getAttribute("name")}`; }
}

user.toJSON();              // { id, name, display_name, ... } sans password
user.makeVisible("password").toJSON();
user.makeHidden("email").toJSON();
user.append("upper").toJSON();
```

Le filtrage s'applique aussi aux relations chargées.

---

## Collections

Les requêtes de modèles renvoient une `Collection` (tableau enrichi) :

```ts
const users = await User.all();
users.first();
users.last();
users.isEmpty();
users.pluck("name");          // ["A", "B", ...]
users.keyBy("id");            // Map<id, User>
users.groupBy("role");        // Map<role, User[]>
users.toJSON();
```

---

## Schéma & migrations

### Blueprint

```ts
import { Schema } from "teloquent";

await Schema().create("users", (t) => {
  t.increments("id");
  t.string("name");
  t.string("email").unique();
  t.boolean("is_active").default(true);
  t.integer("votes").default(0);
  t.text("bio").nullable();
  t.json("meta");
  t.foreignId("team_id");
  t.timestamps();
  t.softDeletes();
});

// ALTER
await Schema().table("users", (t) => {
  t.string("phone").nullable();
  t.dropColumn("bio");
});

await Schema().hasTable("users");
await Schema().dropIfExists("users");
```

Types disponibles : `increments`, `integer`, `bigInteger`, `string`, `text`, `boolean`, `float`, `decimal`, `date`, `datetime`, `timestamp`, `json`, `foreignId`. Modificateurs : `.nullable()`, `.unique()`, `.default(v)`.

### Migrations

```ts
import { Migrator, Schema, type MigrationEntry } from "teloquent";

const migrations: MigrationEntry[] = [
  {
    name: "001_create_users",
    up:   () => Schema().create("users", (t) => { t.increments("id"); t.string("name"); }),
    down: () => Schema().dropIfExists("users"),
  },
];

const m = new Migrator();
await m.run(migrations);      // applique les migrations en attente (nouveau batch)
await m.rollback(migrations); // annule le dernier batch
await m.reset(migrations);    // annule tout
await m.refresh(migrations);  // reset + run
await m.status(migrations);   // [{ name, ran, batch }]
```

Le `Migrator` gère automatiquement une table `migrations` (name, batch), `run` est idempotent, et `rollback` n'annule que le dernier batch.

---

## Événements

```ts
import { ModelEvents } from "teloquent";

ModelEvents.on(User, "creating", (u) => { u.email = String(u.email).toLowerCase(); });
ModelEvents.on(User, "deleted", (u) => { console.log("supprimé", u.getKey()); });
```

Événements : `creating`, `created`, `updating`, `updated`, `deleting`, `deleted`.

---

## Multi-SGBD & tests

Par défaut les tests tournent sur SQLite. Pour rejouer la suite cross-dialecte sur MySQL et PostgreSQL :

```bash
npm run db:up        # démarre Postgres + MySQL (docker compose)
npm run test:pg      # tests sur PostgreSQL
npm run test:mysql   # tests sur MySQL
npm run db:down      # arrête et nettoie
```

Les paramètres de connexion sont surchargeables par variables d'env (voir `tests/helpers/db.ts`). La CI GitHub Actions exécute la suite sur les trois SGBD.

Différences de dialecte gérées automatiquement : quoting des identifiants (`"…"` SQLite/PG, `` `…` `` MySQL), placeholders (`?` vs `$1`), `RETURNING` (PostgreSQL), `ON CONFLICT` vs `ON DUPLICATE KEY UPDATE`, formats de date.

---

## Développement

```bash
npm install
npm run build      # compile src -> dist
npm run example    # démo de bout en bout (examples/basic.ts)
npm run typecheck
npm test           # suite vitest
```

Voir **[GUIDE_TECHNIQUE.md](./GUIDE_TECHNIQUE.md)** pour l'architecture interne, et **[TODO.md](./TODO.md)** pour la feuille de route.

## Licence

MIT
