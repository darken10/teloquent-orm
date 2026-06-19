# Teloquent Playground API

API REST **Express** de démonstration, qui consomme **Teloquent** via un lien local (`file:..`). Sert à tester l'ORM dans des conditions proches d'un vrai projet.

## Installation

Depuis ce dossier :

```bash
npm install
```

`npm install` compile automatiquement Teloquent (script `prepare` du package parent) et le relie en `file:..`.

> SQLite : `better-sqlite3` est installé en dépendance optionnelle. S'il ne compile pas sur votre machine, Teloquent se replie sur `node:sqlite`. Dans ce cas, sur Node 22.x, lancez avec le flag : `node --experimental-sqlite --import tsx src/server.ts` (inutile si `better-sqlite3` est compilé).
>
> Base par défaut : `playground.sqlite` dans ce dossier. Surchargeable via `DB_PATH` (ex. `DB_PATH=":memory:"`).

## Utilisation

```bash
npm run fresh     # crée les tables + données d'exemple (migrate + seed)
npm run dev       # démarre l'API sur http://localhost:3000 (watch)
```

Puis testez avec le fichier `requests.http` (extension REST Client de VS Code) ou en curl :

```bash
curl http://localhost:3000/users?with=posts
curl -X POST http://localhost:3000/users -H "content-type: application/json" \
  -d '{"name":"Idrissa","email":"idrissa@africasys.com"}'
```

## Vérification automatique

```bash
npm run smoke     # démarre l'API sur un port éphémère et teste tous les endpoints
```

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Santé |
| GET | `/users` | Liste (option `?with=posts`) |
| POST | `/users` | Créer |
| GET | `/users/:id` | Détail + articles |
| PUT | `/users/:id` | Mettre à jour |
| DELETE | `/users/:id` | Supprimer |
| GET | `/posts` | Liste + auteur (eager) |
| POST | `/posts` | Créer |
| GET | `/posts/:id` | Détail + auteur |

## Où regarder

- `src/models/` — modèles `User` / `Post` (relations Eloquent-like).
- `src/db.ts` — connexion, migrations, seed.
- `src/app.ts` — routes Express utilisant Teloquent.
