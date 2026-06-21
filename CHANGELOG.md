# Changelog

Toutes les modifications notables de Teloquent sont documentées ici.
Le format suit [Keep a Changelog](https://keepachangelog.com/) et le
[versionnage sémantique](https://semver.org/lang/fr/).

## [1.0.0] - 2026-06-21

Première version publique. ORM Active Record TypeScript inspiré d'Eloquent.

### Ajouté

- **Cœur Active Record** : modèle via `Proxy` (accès magique aux attributs),
  accessors/mutators, casts (`int`, `float`, `boolean`, `string`, `json`,
  `date`, `datetime`), mass assignment (`fillable`/`guarded`), dirty tracking,
  timestamps automatiques, hydratation.
- **Méthodes statiques** : `find`, `findOrFail`, `all`, `where`, `with`,
  `create`, `firstOrNew`, `firstOrCreate`, `updateOrCreate`, `upsert`.
- **Query Builder** : `select`/`selectRaw`, `where`/`orWhere` (+ closures
  imbriquées), `whereIn`, `whereNull`, `whereBetween`, `whereColumn`,
  `whereRaw`, `join`/`leftJoin`, `orderBy`, `groupBy`, `having`,
  `limit`/`offset`, agrégats, `insert`/`update`/`delete`,
  `increment`/`decrement`, `upsert`.
- **Relations** : `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`
  (avec `attach`/`detach`/`sync` et données pivot), eager loading
  imbriqué (`with("a.b.c")`), `withCount`, `whereHas`/`has`/`doesntHave`.
- **Soft deletes** : `withTrashed`, `onlyTrashed`, `restore`, `forceDelete`,
  `trashed`.
- **Scopes** locaux (`scopeXxx`) et globaux (`addGlobalScope`).
- **Pagination** : `paginate`, `simplePaginate`, `forPage`, `chunk`.
- **Sérialisation** : `hidden`/`visible`/`appends` +
  `makeHidden`/`makeVisible`/`append`.
- **Schéma & migrations** : `Schema().create/table/dropIfExists/hasTable`,
  `Blueprint` (types + modificateurs + `softDeletes`), `Migrator`
  (`run`/`rollback`/`reset`/`refresh`/`status`, batches).
- **Événements** de cycle de vie des modèles.
- **Collections** enrichies (`pluck`, `keyBy`, `groupBy`...).
- **Multi-SGBD** : SQLite (better-sqlite3 + repli node:sqlite), MySQL
  (mysql2), PostgreSQL (pg) — grammars dédiées par dialecte, validés sur de
  vrais serveurs (docker-compose + CI).
