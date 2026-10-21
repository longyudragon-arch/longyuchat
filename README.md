# AI Multi-Model Chatroom MVP Specification

## 1. Project purpose

Build a personal web application for conversations with one or more AI models. The first stage validates a runnable, demonstrable core: configure models, have a single-model conversation, receive sequential multi-model replies, and reopen saved conversations.

## 2. MVP scope

### Model management

Create, edit, delete, enable, disable, and connection-test model configurations.

Configuration fields: `name`, `provider`, `baseUrl`, `modelName`, `apiKey`, and `enabled`.

Prioritize OpenAI-compatible APIs. Reserve provider types for Claude, Gemini, Grok, Doubao, and DeepSeek; dedicated non-compatible adapters are outside the initial stage.

### Conversations

Support single-model chat, multi-model group chat, persistent history, and continuing a saved conversation.

Select models and save their order when creating a group. Invoke them in that order for each user message. Each later model receives earlier successful replies from the current round.

Role assignment, `@` interruption, automatic continuation, and autonomous multi-round debate are outside this stage.

### Out of scope

Do not add image uploads, file parsing, voice input/output, prompt templates, long-prompt imports, automatic summaries, search, archives, export, cost dashboards, error-log pages, role assignment, `@` interruption, automatic multi-round continuation, native apps, mini-programs, multiple users, registration, monetization, or permission systems as part of this MVP.

## 3. Technology boundaries

- Frontend: Next.js, React, TypeScript, and Tailwind CSS.
- Server: Next.js API routes; no separate backend service.
- Storage: Prisma ORM and SQLite.

Prioritize a runnable local application and straightforward installation and debugging. PostgreSQL can be evaluated later if needed.

## 4. Pages

### Model management

List models and provide create, edit, delete, enable/disable, and connection-test actions.

### Main chat page

Show the conversation list on the left, messages in the center, the composer below, and participating models with their reply order on the right. Support creating single/group conversations, reopening history, viewing messages, and sending input.

### New group dialog

Enter a room title, select participating models, and arrange their order.

## 5. Data model

### `model_configs`

Stores model configurations available to rooms.

Fields: `id`, `name`, `provider`, `base_url`, `model_name`, `api_key`, `enabled`, `created_at`, `updated_at`.

Keep names unique in the local single-user scenario. Disabled models cannot be selected for new rooms. Only the server may access `api_key`.

### `chat_rooms`

Stores conversation rooms.

Fields: `id`, `title`, `type` (`single` or `group`), `created_at`, `updated_at`.

### `chat_room_models`

Stores room/model membership and ordering.

Fields: `id`, `room_id`, `model_id`, `sort_order`.

Enforce uniqueness of both `room_id + model_id` and `room_id + sort_order`. Single-model rooms must also use this table and bind exactly one model; group rooms must bind at least two.

### `messages`

Stores plain-text messages.

Fields: `id`, `room_id`, `sequence`, `role` (`user`, `assistant`, `system`), nullable `model_id`, `content`, `created_at`.

User messages have no model ID. Enforce uniqueness of `room_id + sequence`; order by sequence rather than inferring order from timestamps.

## 6. API scope

### Models

- `GET /api/models`
- `POST /api/models`
- `PUT /api/models/:id`
- `DELETE /api/models/:id`
- `POST /api/models/:id/test`

### Rooms

- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/:id/messages`
- `POST /api/rooms/:id/messages`

## 7. Message flow

### Single-model conversation

1. Open a room and send input to `POST /api/rooms/:id/messages`.
2. Save the user message.
3. Load the room's single model and call its API.
4. Save the reply and return the new messages for display.

### Group conversation

1. Save the user's input first.
2. Call room models sequentially by `sort_order`.
3. Give each model the room history and earlier successful replies from the current round.
4. Save an `assistant` message immediately after each successful reply.
5. Return the round's saved messages.

## 8. Failure policy

Persist the user message before making model calls. If a model fails or times out, retain earlier saved replies, create no message for the failed model, and stop subsequent calls. Return partial-success information with the failed model ID and a concise error.

Connection-test failures must not write chat messages. A single provider failure must not discard messages already saved in the round.

## 9. API-key security

- Read and use credentials only on the server.
- Never return plaintext `api_key` in model list/detail responses.
- Preserve the old key when an edit does not provide a replacement.
- Never print plaintext credentials in logs or errors.
- Keep real `.env` files out of Git and provide `.env.example`.

User-configured model credentials are business data stored in the database. Application runtime configuration belongs in environment files.

## 10. Directory structure

```text
app/
components/
server/
  adapters/
  orchestrators/
  services/
lib/
prisma/
types/
public/
```

`app/` contains pages and API entry points; `components/` contains UI. Adapters encapsulate model APIs, orchestrators own sequential execution, and services coordinate business logic and data. Shared utilities, constants, error handling, and the database client belong in `lib/`. Keep schemas/migrations in `prisma/` and shared types in `types/`.

## 11. Implementation principles

Keep complex business logic out of pages. Routes receive and validate input, call services, and return responses. Centralize provider calls in adapters and group-reply logic in orchestrators. Preserve these boundaries instead of combining responsibilities to save time.

## 12. Tests and acceptance

### Automated coverage

- Connection tests against a mocked OpenAI-compatible API.
- User and assistant message persistence in single-model chat.
- Group replies in configured order.
- Later models receiving earlier replies from the same round.
- Earlier replies preserved and later models stopped after failure.
- History reloaded after refresh.

### Manual acceptance

Pages open; model CRUD and enable/disable actions work; connection tests return results; single/group rooms can be created; models reply in sequence; messages survive refresh; and saved conversations can be continued.

## 13. Suggested implementation order

1. Initialize Next.js, Tailwind, Prisma/SQLite, and directory boundaries.
2. Implement the model table, CRUD, connection tests, and management page.
3. Implement rooms, membership, and saved model ordering.
4. Implement sending, provider calls, orchestration, persistence, and history loading.
5. Complete the room list, conversation area, and model-order panel.

## 14. Future directions

Dedicated non-compatible provider adapters, images/files/voice, prompt templates, long prompts, summaries/context compression, search/archives/export, cost/error dashboards, role assignment, interruption, automatic continuation, Android, and WeChat mini-programs are future ideas rather than current delivery commitments.

## 15. Goal

Deliver a clear, runnable, extensible AI multi-model chatroom MVP with minimal complexity.

## 16. Deployment preparation

Existing deployment support includes `.env.example`, `npm run start:prod`, `npm run prisma:migrate:deploy`, `GET /api/health`, production-disabled local mock routes, optional Basic Auth, optional model-key encryption, optional sensitive-request limits, request IDs, redacted errors, startup readiness checks, file logging, and SQLite backup scripts.

See the [deployment guide](docs/deployment.md) for instructions and server examples. The newer portal/Daily recovery work is published separately on [`codex/project-recovery-20260920`](https://github.com/longyudragon-arch/longyuchat/tree/codex/project-recovery-20260920).
