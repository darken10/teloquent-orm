# Teloquent

Un ORM **TypeScript** Active Record inspiré de **Laravel Eloquent**. SQLite, MySQL et PostgreSQL.

```ts
import { Model, ConnectionManager, Schema } from "teloquent";

await ConnectionManager.addConnection({ driver: "sqlite", database: "app.sqlite" });

class User extends Model {
  declare id: number;
  declare name: string;
  posts() { return this.hasMany(Post); }
}
class Post extends Model {
  declare id: number;
  declare title: string;
  author() { return this.belongsTo(User, "user_id"); }
}

// CRUD
const user = await User.create({ name: "Zoumana" });
user.name = "Zoumana TRAORE";
await user.save();

// Requêtes
const actifs = await User.where("is_active", true).orderBy("name").get();

// Eager loading (anti N+1)
const users = await User.with("posts").get();
for (const u of users) console.log(u.name, u.getRelation("posts").length);
```

## Pourquoi

- API quasi identique à Eloquent : `find`, `all`, `where`, `create`, `save`, `delete`, `hasMany`, `belongsTo`, `with`, `Schema::create`.
- Typage fort TypeScript (génériques) — l'avantage sur PHP.
- SQL multi-dialecte via une couche *Grammar* dédiée. Valeurs toujours liées (anti-injection).

## Démarrage

```bash
npm install
npm run example     # démo complète sur SQLite en mémoire
npm run typecheck
npm run build
```

> SQLite : utilise `better-sqlite3` si présent, sinon se replie sur `node:sqlite` (Node ≥ 22, sans compilation).

## Tests

```bash
npm test          # lance la suite vitest
```

La suite est en deux parties : des **tests unitaires purs** (génération SQL des 3 dialectes, QueryBuilder, helpers, Collection) qui tournent partout sans base, et des **tests d'intégration SQLite** (`tests/model.test.ts`) qui s'exécutent automatiquement si un driver SQLite est disponible (`better-sqlite3`, ou Node ≥ 22 avec `--experimental-sqlite`) et se désactivent proprement sinon.

## Documentation

Voir **[GUIDE_TECHNIQUE.md](./GUIDE_TECHNIQUE.md)** : architecture détaillée, flux d'une requête, chaque couche, feuille de route, bonnes pratiques.

## État

MVP fonctionnel : Model Active Record (Proxy), QueryBuilder, 3 grammars, driver SQLite testé, dirty tracking, casts, accessors/mutators, relations (hasOne/hasMany/belongsTo) avec eager loading, Collection, Schema/Blueprint, événements. Drivers MySQL/PostgreSQL prêts à brancher. Voir la feuille de route dans le guide.

## Licence

MIT
