# LongyuChat

A personal AI website with a public portal, an AI Daily publication, and a private multi-model chat workspace.

## Features

- Public home page, profile, and project showcase.
- Provider connections, model discovery, model configuration, and connection tests.
- Single-model conversations and sequential multi-model group conversations.
- Persistent messages, conversation history, and round status events.
- Daily source management, collection, clustering, AI drafting with rules-based fallback, publication, archives, and RSS.
- Single-owner access protection, encrypted model credentials, request limits, and server logging.

A group conversation saves the user message first. Each model sees earlier successful replies from the same round. If a model fails, previous replies remain saved and later models are skipped. Round events report progress; they do not stream individual tokens.

Agent runtimes, tool execution, MCP, RAG, knowledge bases, registration, and multi-user accounts are outside the current scope. Live provider quality and external Daily scheduling require separate validation.

## Quick start

Use Node.js 22.12+ on the 22.x line, or Node.js 24+. The recovery checks were run with Node.js 24.14.1.

```sh
git clone https://github.com/longyudragon-arch/longyuchat.git
cd longyuchat
git switch codex/project-recovery-20260920
npm ci
```

Copy `.env.example` to `.env` and configure the database. The default local database is SQLite at `prisma/dev.db`. Keep credentials out of Git.

For a **new, empty database**:

```sh
npm run prisma:migrate:deploy
npm run dev:local -- --port 3000
```

For an existing database, back it up and inspect its migration history before applying migrations. Never reset a database that contains user data.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The local launcher binds to loopback. Configure authentication before exposing the application to a network.

| Area | Path |
| --- | --- |
| Chat workspace | `/rooms` |
| Model management | `/models` |
| AI Daily | `/daily` |
| Daily administration | `/admin/daily` |

The administration link is available to the owner after login, or while access protection is disabled locally.

## Verification

```sh
npm run check
npm run test:ui:smoke
npm run build
npm run test:production
```

`check` runs ESLint, the full TypeScript check, and unit/integration tests. Browser and production smoke checks use isolated synthetic databases and test credentials. They do not call paid providers. Build before running the production smoke check.

## Operations

- `npm run start:prod` loads production configuration and enforces startup readiness checks.
- `npm run sqlite:backup` creates a consistent SQLite online backup and checks its integrity.
- `npm run secrets:encrypt` backs up the database, then encrypts legacy plaintext model credentials using `MODEL_SECRET_ENCRYPTION_KEY`.

Keep encryption keys and backups in controlled storage. A backup taken before encryption can still contain plaintext credentials. See the [deployment guide](docs/deployment.md) for production setup.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `app/` | Pages and API route entry points |
| `components/` | User interface |
| `server/services/` | Business logic and persistence coordination |
| `server/adapters/` | Provider adapters |
| `server/orchestrators/` | Sequential model execution |
| `lib/` | Shared configuration and utilities |
| `prisma/` | SQLite schema and migrations |
| `types/` | Shared types |

The application remains a modular monolith built with Next.js 16.3.5, React 19.2.4, TypeScript, Tailwind CSS, Prisma 7.10.0, and SQLite.

## Project documentation

- [GitHub synchronization and history notes](docs/GITHUB_SYNC_2026-10-21.md)
- [Project overview](docs/PROJECT_OVERVIEW.md)
- [Recovery changes and verification](docs/RECOVERY_CHANGES_2026-09-20.md)
- [Historical recovery audit](docs/PROJECT_RECOVERY_REPORT.md)
- [Original MVP specification](docs/legacy/MVP_SPEC.md)
- [AI Daily module](ai-daily/README.md)

The detailed recovery audit and operational records retain their original Chinese text. They distinguish verified behavior from remaining work, including historical credential exposure, migration-history differences, provider DNS binding, dependency advisories, and live-service validation.
