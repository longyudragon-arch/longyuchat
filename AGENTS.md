# AGENTS.md

## 1. Purpose

These rules guide AI agents and collaborators working in this repository.

Use `README.md` and the actual implementation to establish the current scope. The pre-repair audit is in `docs/PROJECT_RECOVERY_REPORT.md`; recovery progress is in `docs/RECOVERY_CHANGES_2026-09-20.md`. The original MVP specification in `docs/legacy/MVP_SPEC.md` is historical and does not describe all existing portal and Daily modules.

## 2. Current scope

Maintain the existing capabilities:

- Public portal, profile, and project showcase.
- Provider and model configuration, discovery, and connection tests.
- Single-model chat, sequential multi-model replies, saved history, and continued conversations.
- Daily sources, collection, drafting, publication, archives, and RSS.
- Single-owner protection, credential encryption, rate limits, and logging.

Recovery work does not authorize new product capabilities. Without an explicit request, do not add agents, MCP, RAG, knowledge bases, file or voice input, role assignment, automatic multi-round execution, multiple users, registration, monetization, or native apps.

## 3. Implementation principles

### Keep scope focused

Implement the smallest useful change for the current stage. Do not introduce later-stage features in advance.

### Preserve extension points

Keep provider adapters even when supporting only OpenAI-compatible APIs. Keep an orchestration layer even when replies follow a fixed order. Do not embed model calls or future extension logic directly in routes or pages.

### Preserve directory boundaries

- `app/`: pages and API route entry points.
- `components/`: UI components.
- `server/services/`: business logic and data coordination.
- `server/adapters/`: provider calls and compatibility differences.
- `server/orchestrators/`: sequential model execution.
- `lib/`: shared utilities, configuration, and database client.
- `prisma/`: schema and migrations.
- `types/`: shared types.

## 4. Code changes

Prefer local changes. Avoid unjustified rewrites or changes to established layering.

Use names that describe responsibility. Avoid ambiguous names such as `test2.ts` or `newService.ts`.

Keep default model names, third-party endpoints, timeouts, and system prompts in environment variables, constants, or explicit configuration objects rather than business logic.

## 5. Layer responsibilities

Pages display information and trigger actions; they do not contain complex business logic.

API routes only receive and validate parameters, call services, and return responses. Do not put provider calls or business workflows directly in routes.

Services coordinate rooms, messages, model configuration, and persistence, and call adapters and orchestrators.

Adapters encapsulate model calls and provider differences. OpenAI-compatible APIs remain the first integration path.

Orchestrators own sequential calls, pass earlier successful replies into later models' context, and enforce the failure policy.

## 6. Data and security

### Model credentials

- Use `api_key` only on the server.
- Never return plaintext credentials in API responses.
- Preserve the existing key when an edit does not supply a replacement.
- Never print plaintext credentials in logs, stack traces, or debug output.

### Data constraints

- Enforce uniqueness of `room_id + model_id` in `chat_room_models`.
- Enforce uniqueness of `room_id + sort_order` in `chat_room_models`.
- A single-model room must bind exactly one model.
- A group room must bind at least two models.
- Messages must have a sortable `sequence` or equivalent ordering field.

## 7. Group conversation failure policy

- Save the user message before calling any model.
- Preserve successful replies if a later model fails.
- Do not create a message for the failed model.
- Stop all subsequent model calls.
- Return partial-success information.

Do not switch to all-or-nothing rollback or continue after failure unless the task explicitly requests that behavior.

## 8. Minimum test coverage

Delivery must cover:

- Connection tests against a mocked provider.
- Single-model message persistence.
- Sequential group replies.
- Later models receiving earlier replies from the current round.
- Partial success when a model fails mid-round.
- Reloading historical messages.

Report missing automated coverage and its practical risk when a task does not close a gap.

## 9. Changes requiring an explicit request

Do not:

- Call third-party model APIs directly from pages or components.
- Scatter orchestration across routes.
- Add complex state management libraries, queues, middleware, or microservices.
- Switch databases.
- Replace single-owner protection or introduce multi-user authentication.
- Add unconfirmed later-stage features.

## 10. Delivery

Report the files changed, the reason for the change, verification performed, and material remaining limitations.

## 11. Goal

Maintain a clear, runnable personal AI website with minimal complexity and explicit boundaries between the portal, Daily publication, and multi-model chat.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
