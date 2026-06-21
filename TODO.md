# TODO — Teloquent v3

Suivi des fonctionnalités. `[x]` = développé et testé · `[~]` = partiel / à brancher · `[ ]` = à faire.

Dernière mise à jour : 2026-06-19.

---

## ✅ Déjà développé

### Cœur Active Record
- [x] Classe de base `Model` avec `Proxy` (accès magique aux attributs façon Eloquent)
- [x] Accès propriété : `user.name` / `user.name = ...`
- [x] Accessors (`getXxxAttribute`) et mutators (`setXxxAttribute`)
- [x] Casting des attributs : `int`, `float`, `boolean`, `string`, `json`, `date`, `datetime`
- [x] Mass assignment : `fillable` / `guarded`
- [x] Dirty tracking : `isDirty()`, `getDirty()` (UPDATE limité aux colonnes modifiées)
- [x] Timestamps automatiques (`created_at` / `updated_at`)
- [x] Sérialisation : `toObject()` / `toJSON()`
- [x] Hydratation depuis lignes brutes (`hydrate`, `setRawAttributes`)

### Méthodes statiques & persistance
- [x] `find`, `findOrFail`, `all`, `where`, `with`, `query`, `create`
- [x] `save` (INSERT / UPDATE), `update`, `delete`, `refresh`

### Query Builder
- [x] `select`, `distinct`
- [x] `where` / `orWhere`, `whereIn` / `whereNotIn`, `whereNull` / `whereNotNull`, `whereBetween`, `whereRaw`
- [x] `join` / `leftJoin`
- [x] `orderBy`, `latest`, `groupBy`, `having`, `limit` / `offset`, `take` / `skip`
- [x] Lecture : `get`, `first`, `firstOrFail`, `value`, `pluck`, `exists`
- [x] Agrégats : `count`, `max`, `min`, `sum`, `avg`
- [x] Écriture : `insert`, `insertGetId`, `update`, `delete`
- [x] Debug : `toSql()` · `clone()`
- [x] Paramètres liés systématiques (anti-injection SQL)

### Grammar (génération SQL multi-dialecte)
- [x] `Grammar` de base (select / insert / update / delete / agrégats)
- [x] SQLite (quoting `"..."`, placeholders `?`)
- [x] MySQL (quoting backticks)
- [x] PostgreSQL (placeholders `$1, $2...`)

### Relations
- [x] `hasOne`, `hasMany`, `belongsTo`
- [x] Chargement lazy (`user.posts().getResults()`)
- [x] Eager loading `with(...)` (anti N+1, 1 requête par relation)
- [x] `getRelation`, `setRelation`, `relationLoaded`, `load`

### Connexions & drivers
- [x] `Connection` (exec, transactions avec commit/rollback)
- [x] `ConnectionManager` (connexions nommées, défaut)
- [x] Driver SQLite (`better-sqlite3` + repli `node:sqlite`)
- [x] Résolution robuste de `better-sqlite3` (cas symlink `file:` / `npm link`)

### Schéma & événements
- [x] `Blueprint` (increments, integer, string, text, boolean, float, decimal, date, datetime, json, foreignId, timestamps + modifiers nullable/unique/default)
- [x] `Schema().create / drop / dropIfExists`
- [x] Base `Migration` (up/down)
- [x] Événements de modèle (`creating`, `created`, `updating`, `updated`, `deleting`, `deleted`)

### Outillage & qualité
- [x] Collection enrichie (`pluck`, `keyBy`, `groupBy`, `first`, `last`, `isEmpty`)
- [x] Décorateurs optionnels (`@table`, `@primaryKey`, `@casts`, `@connection`)
- [x] Helpers (`snake`, `studly`, `plural`, `tableName`, `foreignKey`)
- [x] Suite de tests vitest (41 tests : unitaires purs + intégration SQLite)
- [x] Exemple end-to-end (`examples/basic.ts`)
- [x] Projet de test API REST Express (`playground-api/`) avec lien `file:`
- [x] Guide technique complet (`GUIDE_TECHNIQUE.md`)

---

## 🟡 Partiel / à finaliser

- [x] **Driver MySQL** (`mysql2`) — **validé sur vrai serveur** (77/77). Bug dates ISO corrigé.
- [x] **Driver PostgreSQL** (`pg`) — **validé sur vrai serveur**. Bugs corrigés : `insertGetId`/RETURNING, interop ESM/CJS de `pg`, canonicalisation des clés d'eager loading (bigint renvoyés en chaînes).
- [x] **Infra de test multi-dialecte** — docker-compose (mysql+postgres), helper env-driven, `tests/dialects.test.ts`, scripts `test:pg`/`test:mysql`, CI GitHub Actions
- [ ] **Pool de connexions** — connexion simple pour l'instant (pas de pooling MySQL/PG)

---

## 🔜 À développer

### Relations avancées
- [x] `belongsToMany` (table pivot) + `attach` / `detach` / `sync` + eager loading + données pivot
- [ ] `hasManyThrough` / `hasOneThrough`
- [ ] Relations polymorphes (`morphTo`, `morphMany`)
- [x] Eager loading **imbriqué** : `with("posts.comments")` (récursif, tous types de relations)
- [x] `withCount` (hasMany / hasOne / belongsTo / belongsToMany)
- [ ] Eager loading **contraint** : `with({ posts: q => q.where(...) })`
- [x] `whereHas` / `orWhereHas` / `has` / `doesntHave` (EXISTS corrélé, tous types de relations)

### Modèle
- [x] **Soft deletes** (`deleted_at`, `delete` soft, `withTrashed`, `onlyTrashed`, `restore`, `forceDelete`, `trashed`) + `Blueprint.softDeletes()`
- [x] **Scopes** locaux (`scopePublished` → `scope("published")`) et globaux (`addGlobalScope`)
- [x] `firstOrNew`, `firstOrCreate`, `updateOrCreate`
- [ ] `findMany`
- [x] `$hidden` / `$visible` / `$appends` + `makeHidden` / `makeVisible` / `append` (instance)
- [ ] `replicate()` (duplication d'instance)
- [ ] Événements `saving` / `saved` / `retrieved` + classes Observer dédiées

### Query Builder
- [x] `whereColumn`, groupes de `where` imbriqués (closures `where(q => ...)`), `selectRaw`
- [ ] Sous-requêtes (`whereIn` avec closure, `selectSub`)
- [ ] `orHaving`, `havingRaw`
- [ ] `rightJoin`, `crossJoin`, jointures avec closure
- [x] `upsert` (on conflict / on duplicate key, multi-dialecte)
- [x] `increment` / `decrement` (instance + masse)

### Pagination & performance
- [x] `paginate()` / `simplePaginate()` / `forPage()` (scopes & soft deletes respectés)
- [x] `chunk()` (traitement par lots)
- [ ] `chunkById()` (chunk stable par clé primaire)
- [ ] `cursor()` (itération mémoire-efficace)
- [ ] Cache de requêtes optionnel

### Schéma & migrations
- [ ] Runner de migrations (table `migrations`, `migrate` / `rollback` / `refresh`)
- [ ] `Schema().table()` pour ALTER (ajout/suppression de colonnes)
- [ ] Contraintes de clés étrangères réelles (`foreign().references().on()`)
- [ ] Index (`index`, `unique`, `primary` composites)
- [ ] Seeders structurés

### Drivers & SGBD
- [x] SQLite, MySQL et PostgreSQL validés sur de vrais serveurs (docker + CI)
- [ ] Pool de connexions (MySQL/PG)
- [ ] Lecture/écriture séparées (read/write connections)
- [ ] Driver `node:sqlite` natif activable (Node ≥ 22) en option de config
- [ ] Lecture/écriture séparées (read/write connections)

### Qualité & DX
- [x] Tests d'intégration MySQL + PostgreSQL (CI avec services Docker)
- [ ] Tests des cas d'erreur (`findOrFail`, contrainte unique, rollback)
- [ ] Couverture de code (coverage) + seuil minimal
- [ ] Typage encore plus fort des attributs (génériques sur les colonnes du modèle)
- [ ] Publication npm (build dual ESM/CJS, `.d.ts`)
- [ ] CHANGELOG + versionnage sémantique

---

## Suggestions d'ordre de priorité

1. ~~**Soft deletes** + **scopes**~~ ✅ fait
2. ~~**`belongsToMany`**~~ ✅ fait
3. ~~**Pagination** (`paginate`, `simplePaginate`, `chunk`)~~ ✅ fait
4. ~~**MySQL + PostgreSQL** (validation PG + infra docker/CI multi-dialecte)~~ ✅ fait (confirmer MySQL sur vrai serveur)
5. ~~**Eager loading imbriqué** + `withCount`~~ ✅ fait
6. ~~**Query builder avancé** (`whereHas`, where imbriqués, `whereColumn`)~~ ✅ fait
7. **Runner de migrations** + `Schema().table()` (ALTER), ou publication npm.
5. **Pagination** (`paginate`, `chunk`).
6. CI multi-SGBD + publication npm.
