# LongyuChat Project Overview

LongyuChat is a personal AI website with a public portal, AI Daily, and a private multi-model chat workspace. It uses a modular monolith and prioritizes a reliable core before adding new capabilities.

## Recovery lineage

The original `main` snapshot at `7e29b4f` predates the portal and Daily work. The recovery branch, `codex/project-recovery-20260920`, was created from `257fbeafb08b16c7d126e7e8d8ec7c801184b787`, 45 commits ahead of that snapshot.

Recovery used a separate worktree and a database copy. Original user files and the original database were preserved. The October 2026 GitHub synchronization translates repository-facing documentation and the historical Chinese commit title; historical SHA references above identify the pre-rewrite snapshots. The synchronization backup contains the old-to-new commit map.

## Architecture entry points

| Area | Entry points |
| --- | --- |
| Portal and navigation | `app/layout.tsx`, `components/app-navigation.tsx`, `components/home-dashboard.tsx` |
| Chat UI | `components/room-chat-page.tsx`, `lib/client/longyuchat-client.ts` |
| Messages and rounds | `server/services/room-message-service.ts`, `conversation-round-service.ts` |
| Sequential orchestration | `server/orchestrators/conversation-orchestrator.ts` |
| Providers | `server/adapters/`, `provider-connection-service.ts`, `model-config-service.ts` |
| Database | `prisma/schema.prisma`, `prisma/migrations/`, `lib/prisma.ts` |
| Daily publication | `daily-pipeline-service.ts`, `daily-fetch-service.ts`, `daily-issue-service.ts` |
| Access protection | `proxy.ts`, `lib/app-auth.ts`, `lib/server-access.ts` |
| External requests | `server/http/public-http.ts`, `provider-request.ts` |
| Operations | `server/security/`, `server/observability/`, `scripts/start-prod.mjs`, `scripts/sqlite-backup.mjs` |

See the [README](../README.md) for setup and stack versions. The AI core provides provider adaptation, ordered execution, and context propagation. It does not implement an agent runtime, tool execution, MCP, vector retrieval, or multiple users. The project showcase remains static content.

## Behavior contracts

- Persist the user message before model calls. Execute in order, preserve earlier successes, and skip later models after a failure.
- Expose only published Daily issues publicly. Read drafts through protected administration APIs.
- Report collection failures accurately. Preserve an existing publication when regeneration fails. Commit content and status atomically.
- Reuse the production Prisma client within the process.
- Bind the local launcher to loopback. Require access protection and credential encryption before public deployment.

## Verification and remaining work

The recovery baseline passed lint, full type checking, 316 tests in 44 files, a production build, browser smoke checks, and ten production smoke checks. Historical results are not evidence of a currently running production service.

Remaining work includes historical credential rotation, a migration checksum discrepancy, binding provider connections to validated DNS addresses, dependency advisories, and live-provider/scheduler validation.

Read the [recovery changes](RECOVERY_CHANGES_2026-09-20.md) for implementation evidence and the [historical audit](PROJECT_RECOVERY_REPORT.md) for broader architecture and product findings. Preserve user data, keep secrets out of reports, and do not equate local smoke checks with production acceptance.
