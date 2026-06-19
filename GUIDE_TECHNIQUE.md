# Guide technique — Teloquent v3

Un ORM TypeScript **Active Record** conçu pour se rapprocher le plus possible de **Laravel Eloquent**, tout en exploitant le typage fort de TypeScript.

Ce document est la référence d'architecture et d'implémentation du package. Il explique la philosophie, chaque couche, le flux d'une requête, les choix techniques, la feuille de route et la manière d'étendre le projet.

---

## 1. Philosophie et objectifs

L'objectif est de retrouver l'ergonomie d'Eloquent : un modèle est une classe, on lit et on écrit en base via des méthodes expressives (`User.find(1)`, `user.save()`, `user.posts()`), et le SQL reste invisible dans 95 % des cas.

Trois principes guident le projet :

1. **Fidélité à Eloquent.** L'API publique imite volontairement les noms et le comportement de Laravel : `find`, `all`, `where`, `create`, `save`, `delete`, `hasMany`, `belongsTo`, `with`, `Schema::create`, etc.
2. **Typage fort.** Là où Eloquent repose sur la magie dynamique de PHP, Teloquent ajoute des génériques et des signatures typées. C'est la valeur ajoutée par rapport à PHP : l'autocomplétion et la vérification au compile-time.
3. **Indépendance du SGBD.** Le SQL n'est jamais écrit en dur dans la logique métier : il est produit par une couche *Grammar* propre à chaque dialecte (SQLite, MySQL, PostgreSQL). Ajouter un SGBD = ajouter un driver + une grammar.

### Le défi central : la « magie » d'Eloquent en TypeScript

En PHP, Eloquent intercepte tout accès à une propriété inconnue (`$user->name`) via `__get`/`__set`. TypeScript n'a pas d'équivalent natif. Teloquent résout cela avec un **`Proxy` JavaScript** : le constructeur du modèle retourne un Proxy qui route tout accès à un attribut non déclaré vers `getAttribute()` / `setAttribute()`. Les méthodes (sur le prototype) et les champs internes restent accessibles normalement.

```ts
class User extends Model {
  declare name: string;   // 'declare' = typage seul, aucun champ réel émis
}
const u = new User();
u.name = "Zoumana";       // intercepté -> setAttribute('name', ...)
console.log(u.name);      // intercepté -> getAttribute('name')
```

> Détail important du `tsconfig` : `useDefineForClassFields: false`. Sans cela, les champs de classe seraient définis comme propriétés réelles et court-circuiteraient le Proxy.

---

## 2. Vue d'ensemble de l'architecture

Teloquent est organisé en couches, de la plus haute (modèle) à la plus basse (driver) :

```
            ┌─────────────────────────────────────────────┐
   API      │  Model (Active Record)  +  décorateurs       │
 publique   │  find / all / save / delete / hasMany / with │
            └───────────────┬─────────────────────────────┘
                            │ hydrate / eager load
            ┌───────────────▼─────────────────────────────┐
            │  ModelQueryBuilder  (hydratation + relations)│
            └───────────────┬─────────────────────────────┘
                            │ étend
            ┌───────────────▼─────────────────────────────┐
            │  QueryBuilder  (where, orderBy, insert...)   │
            └───────────────┬─────────────────────────────┘
                            │ compile via
            ┌───────────────▼─────────────────────────────┐
            │  Grammar  (SQLite / MySQL / Postgres)        │  ← génère le SQL
            └───────────────┬─────────────────────────────┘
                            │ SQL + bindings
            ┌───────────────▼─────────────────────────────┐
            │  Connection  (transactions, exec)            │
            └───────────────┬─────────────────────────────┘
                            │ I/O
            ┌───────────────▼─────────────────────────────┐
            │  Driver  (better-sqlite3 / node:sqlite /     │
            │           mysql2 / pg)                       │
            └─────────────────────────────────────────────┘
```

Une règle d'or : **chaque couche ne connaît que la couche immédiatement inférieure.** Le `Model` ne sait pas écrire du SQL, le `QueryBuilder` ne sait pas parler à la base, le `Driver` ne sait pas ce qu'est un modèle.

---

## 3. Arborescence des dossiers

```
Teloquent-v3/
├── package.json              # ESM, scripts, peerDeps optionnelles
├── tsconfig.json             # config TS (decorators, useDefineForClassFields:false)
├── tsconfig.build.json       # build de la lib (src -> dist)
├── GUIDE_TECHNIQUE.md        # ce document
├── README.md                 # prise en main rapide
│
├── src/
│   ├── index.ts              # API publique (tous les exports)
│   │
│   ├── types/
│   │   └── index.ts          # types partagés (Driver, Dialect, ConnectionConfig...)
│   │
│   ├── connection/
│   │   ├── Connection.ts          # 1 connexion = 1 driver + 1 grammar
│   │   ├── ConnectionManager.ts   # registre des connexions nommées
│   │   └── drivers/
│   │       ├── SQLiteDriver.ts     # better-sqlite3 + repli node:sqlite
│   │       ├── MySQLDriver.ts      # mysql2 (stub fonctionnel)
│   │       └── PostgresDriver.ts   # pg (stub fonctionnel)
│   │
│   ├── query/
│   │   ├── QueryBuilder.ts    # builder fluide bas niveau
│   │   ├── types.ts           # forme interne d'une requête (QueryComponents)
│   │   └── grammars/
│   │       ├── Grammar.ts          # base : compile select/insert/update/delete
│   │       ├── SQLiteGrammar.ts
│   │       ├── MySQLGrammar.ts
│   │       └── PostgresGrammar.ts  # placeholders $1, $2...
│   │
│   ├── eloquent/
│   │   ├── Model.ts               # cœur Active Record (Proxy)
│   │   ├── ModelQueryBuilder.ts   # builder qui hydrate + eager loading
│   │   ├── Collection.ts          # tableau enrichi (pluck, groupBy...)
│   │   └── decorators.ts          # @table, @casts, @primaryKey (optionnels)
│   │
│   ├── relations/
│   │   ├── Relation.ts        # base abstraite + chaînage fluide
│   │   ├── HasMany.ts
│   │   ├── HasOne.ts
│   │   └── BelongsTo.ts
│   │
│   ├── schema/
│   │   ├── Blueprint.ts       # $table->string()... -> SQL
│   │   ├── SchemaBuilder.ts   # Schema().create() / drop()
│   │   └── Migration.ts       # base de migration (up/down)
│   │
│   ├── events/
│   │   └── ModelEvents.ts     # observers : creating, created, updating...
│   │
│   └── support/
│       └── str.ts             # snake, studly, plural, foreignKey
│
└── examples/
    └── basic.ts              # démo complète de bout en bout
```

---

## 4. Le flux d'une requête, pas à pas

Prenons `await User.where("is_active", true).orderBy("name").get()`.

1. `User.where(...)` (statique) crée un `ModelQueryBuilder` lié à la classe `User`, positionne la table (`users`) et ajoute une clause `where`.
2. `.orderBy("name")` ajoute un tri. Chaque méthode mute l'état interne (`QueryComponents`) et renvoie `this` → chaînage fluide.
3. `.get()` est **surchargé** dans `ModelQueryBuilder` :
   - il appelle `super.get()` du `QueryBuilder`, qui demande à la `Grammar` de **compiler** `QueryComponents` en `{ sql, bindings }` ;
   - la `Connection` transmet le SQL et les paramètres au `Driver` ;
   - le driver renvoie des lignes brutes ;
   - chaque ligne est **hydratée** en instance `User` via `User.hydrate(row)` ;
   - si des relations ont été demandées via `.with(...)`, l'**eager loading** se déclenche ;
   - le tout est renvoyé dans une `Collection<User>`.

Le SQL produit : `select * from "users" where "is_active" = ? order by "name" asc` avec `bindings = [true]`. **Toutes les valeurs sont liées en paramètres** — aucune interpolation de chaîne, donc pas d'injection SQL.

---

## 5. Détail des couches

### 5.1 Driver (`src/connection/drivers`)

Le contrat `Driver` (dans `types/index.ts`) est volontairement minimal :

```ts
interface Driver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  select<T>(sql: string, bindings: unknown[]): Promise<T[]>;
  statement(sql: string, bindings: unknown[]): Promise<StatementResult>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  readonly dialect: Dialect;
}
```

- **SQLiteDriver** essaie `better-sqlite3` (performant), et **se replie automatiquement sur `node:sqlite`** (intégré à Node ≥ 22, zéro compilation native). C'est pratique en dev et en CI.
- **MySQLDriver / PostgresDriver** sont des stubs fonctionnels : la structure est complète, à brancher/tester sur une vraie base. `mysql2` et `pg` sont des `peerDependencies` **optionnelles** : importées dynamiquement pour ne pas les imposer.

Tout est asynchrone (`Promise`) même pour SQLite synchrone, afin d'unifier l'API avec les drivers réseau.

### 5.2 Connection & ConnectionManager

`Connection` associe un driver et une grammar, expose `table()`, `query()`, `select()`, `statement()` et `transaction(callback)` (commit/rollback automatique, profondeur gérée pour les appels imbriqués).

`ConnectionManager` est le registre statique global (équivalent du `DatabaseManager` de Laravel). On enregistre une connexion nommée, on récupère la connexion par défaut, on ferme tout.

```ts
await ConnectionManager.addConnection({ driver: "sqlite", database: "app.sqlite" });
await ConnectionManager.addConnection({ driver: "pgsql", host: "...", database: "prod" }, "reporting");
```

### 5.3 QueryBuilder (`src/query/QueryBuilder.ts`)

Builder fluide bas niveau, indépendant des modèles. Il accumule l'état dans `QueryComponents` puis délègue la génération SQL à la `Grammar`. Couverture actuelle :

- Sélection : `select`, `distinct`, `where` / `orWhere`, `whereIn` / `whereNotIn`, `whereNull` / `whereNotNull`, `whereBetween`, `whereRaw`, `join` / `leftJoin`, `orderBy`, `groupBy`, `having`, `limit` / `offset`.
- Lecture : `get`, `first`, `value`, `pluck`, `exists`.
- Agrégats : `count`, `max`, `min`, `sum`, `avg`.
- Écriture : `insert`, `insertGetId`, `update`, `delete`.
- Debug : `toSql()` renvoie `{ sql, bindings }`.

### 5.4 Grammar (`src/query/grammars`)

C'est le traducteur `QueryComponents` → SQL. La classe `Grammar` de base contient toute la logique commune ; chaque dialecte ne surcharge que ses différences :

| Aspect | SQLite | MySQL | PostgreSQL |
|---|---|---|---|
| Quoting des identifiants | `"col"` | `` `col` `` | `"col"` |
| Placeholders | `?` | `?` | `$1, $2, ...` |
| Auto-increment | `integer primary key autoincrement` | `auto_increment primary key` | `serial` |
| Type chaîne | `varchar` | `varchar(255)` | `varchar(255)` |
| Type JSON | `text` | `json` | `jsonb` |

La conversion des placeholders Postgres se fait dans un hook `finalize(sql)` qui remplace séquentiellement les `?` par `$1, $2…`. Comme aucune valeur n'est jamais interpolée dans le SQL, ce remplacement est sûr.

### 5.5 Model (`src/eloquent/Model.ts`)

Le cœur. Points clés de l'implémentation :

- **Proxy** : le constructeur retourne `new Proxy(this, MODEL_HANDLER)`. Le handler route les accès inconnus vers `getAttribute`/`setAttribute`, laisse passer les méthodes du prototype et les champs internes réservés (`attributes`, `original`, `loadedRelations`, `$exists`).
- **Attributs** : stockés dans `this.attributes`. `original` sert au *dirty tracking* (`isDirty()`, `getDirty()`), pour n'émettre dans l'`UPDATE` que les colonnes réellement modifiées.
- **Casts** : `static casts = { is_active: "boolean", meta: "json" }`. Conversion à la lecture (`castGet`) et sérialisation à l'écriture (json → string).
- **Accessors / Mutators** : conventions `getXxxAttribute()` et `setXxxAttribute()`, comme Eloquent.
- **Mass assignment** : `fillable` / `guarded` filtrent `fill()` et `create()`.
- **Timestamps** : `created_at` / `updated_at` gérés automatiquement si `timestamps = true`.
- **Persistance** : `save()` choisit INSERT (nouveau) ou UPDATE (existant, seulement le dirty) ; `delete()`, `update()`, `refresh()`.
- **Statiques typées** : `find`, `findOrFail`, `all`, `where`, `with`, `create`, `query` — toutes typées via `this: ModelCtor<T>` pour renvoyer le bon sous-type.

### 5.6 ModelQueryBuilder (`src/eloquent/ModelQueryBuilder.ts`)

Étend `QueryBuilder` et ajoute la dimension « modèle » :

- `get()` hydrate les lignes en instances et renvoie une `Collection<T>` ;
- `first()` / `firstOrFail()` ;
- `with(...relations)` mémorise les relations à charger ;
- `update()` injecte automatiquement `updated_at` ;
- l'**eager loading** charge chaque relation en **une seule requête** (`whereIn` sur les clés), puis distribue les résultats sur les parents — c'est la solution au problème N+1.

### 5.7 Relations (`src/relations`)

Comme Eloquent, une relation est une **méthode** du modèle :

```ts
class User extends Model {
  posts() { return this.hasMany(Post); }            // 1-N
  profile() { return this.hasOne(Profile); }         // 1-1
}
class Post extends Model {
  author() { return this.belongsTo(User, "user_id"); } // N-1 inverse
}
```

Chaque classe de relation sait :
- s'auto-contraindre pour un parent donné (chargement *lazy* : `await user.posts().getResults()`) ;
- exposer les clés et charger un lot pour l'*eager loading* ;
- distribuer (`match`) les résultats sur les parents.

> **Différence avec PHP** : en PHP, `$user->posts` (sans parenthèses) renvoie la collection chargée, et `$user->posts()` la requête. En TypeScript, `posts` est une méthode ; on lit donc la relation chargée via `user.getRelation("posts")`, et on requête via `user.posts()`.

### 5.8 Schema & Migrations (`src/schema`)

`Blueprint` décrit une table de façon fluide (`t.increments("id")`, `t.string("name").unique()`, `t.timestamps()`) et se compile en `CREATE TABLE` via la grammar. `Schema().create(table, cb)` exécute le DDL. `Migration` fournit la base `up()`/`down()`.

### 5.9 Événements (`src/events`)

Observers de cycle de vie : `creating`, `created`, `updating`, `updated`, `deleting`, `deleted`. Déclenchés automatiquement par `Model.save()` / `delete()`.

```ts
ModelEvents.on(User, "creating", (u) => { u.email = String(u.email).toLowerCase(); });
```

---

## 6. Conventions (comme Eloquent)

| Élément | Convention | Override |
|---|---|---|
| Nom de table | pluriel snake_case du nom de classe (`BlogPost` → `blog_posts`) | `static table = "..."` |
| Clé primaire | `id` | `static primaryKey = "..."` |
| Clé étrangère | `<modèle>_id` (`user_id`) | argument de `hasMany/belongsTo` |
| Timestamps | `created_at`, `updated_at` | `static timestamps = false` |

---

## 7. Feuille de route

**Déjà en place (MVP fonctionnel) :** Model Active Record, QueryBuilder, Grammars 3 dialectes, driver SQLite testé, dirty tracking, casts, accessors/mutators, `hasOne`/`hasMany`/`belongsTo` avec eager loading, Collection, Schema/Blueprint, événements.

**Prochaines étapes recommandées (ordre suggéré) :**

1. **Brancher et tester** les drivers MySQL et PostgreSQL sur de vraies bases (les classes sont prêtes).
2. **`belongsToMany`** (pivot) et `hasManyThrough`.
3. **Eager loading imbriqué** (`with("posts.comments")`) et contraint (`with({ posts: q => q.where(...) })`).
4. **Soft deletes** (`deleted_at`) et **scopes** globaux/locaux.
5. **Runner de migrations** (table `migrations`, `migrate` / `rollback`).
6. **Pool de connexions** pour MySQL/PG, et `whereHas` / sous-requêtes.
7. **Pagination** (`paginate`), `chunk`, `cursor`.
8. **Suite de tests** (vitest) : compilation SQL par dialecte + intégration SQLite.

---

## 8. Bonnes pratiques de développement

- **Tester la Grammar en isolation.** `toSql()` rend le SQL vérifiable sans base : c'est le meilleur filet de sécurité, et c'est rapide.
- **Toujours passer par des bindings.** Ne jamais concaténer une valeur dans le SQL. Le DDL (noms de colonnes/types) fait exception car il ne contient pas de données utilisateur.
- **Garder les couches étanches.** Si vous écrivez du SQL ailleurs que dans une Grammar, c'est un signal d'alarme.
- **Génériques d'abord.** Chaque nouvelle API publique doit préserver le type du modèle (`ModelQueryBuilder<T>`), sinon on perd l'avantage sur PHP.
- **MVP avant exhaustivité.** Un ORM est immense ; livrez par tranches verticales testées.

---

## 9. Limites connues (à ce stade)

- Drivers MySQL/PostgreSQL non encore testés en conditions réelles.
- Pas encore de `belongsToMany`, soft deletes, scopes, migrations runner, pagination.
- Eager loading sur un seul niveau (pas de `with("a.b")`).
- Pas de pool de connexions.

Ces points sont précisément la feuille de route de la section 7.

---

## 10. Démarrage rapide

```bash
npm install
npm run example       # lance examples/basic.ts (SQLite en mémoire)
npm run typecheck     # vérification TypeScript
npm run build         # compile src -> dist
```

Voir `examples/basic.ts` pour une démonstration complète : schéma, CRUD, casts, accessor, relations lazy et eager, agrégats, suppression, et SQL généré.
