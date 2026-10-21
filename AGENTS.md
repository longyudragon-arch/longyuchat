# AGENTS.md

## 1. Purpose

These rules guide AI agents and collaborators working in this repository.

Use the MVP scope in `README.md` as the current specification. If other documents conflict, follow the README scope and use these engineering rules to fill in implementation details.

## 2. Current scope

Only implement model configuration, connection tests, single-model chat, sequential multi-model replies, and saved history with continued conversations.

Do not add image uploads, file parsing, voice input/output, prompt templates, long-prompt imports, automatic summaries, search/archives/export, cost or error-log pages, role assignment, `@` interruption, automatic continuation, multiple users, login/registration, monetization, permission systems, native apps, or mini-programs without an explicit request.

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
- Introduce authentication.
- Add unconfirmed later-stage features.

## 10. Delivery

Report the files changed, the reason for the change, verification performed, and material remaining limitations.

## 11. Goal

Deliver a clear, runnable, extensible AI multi-model chatroom MVP with minimal complexity.
