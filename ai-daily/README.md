# LongyuChat AI Daily

AI Daily is an existing module of the LongyuChat website. Its implementation lives in `app/daily`, `app/admin/daily`, `app/api/daily`, and `server/services/daily-*.ts`.

It includes source management, collection, drafting, publication, archives, and RSS. Other documents in this directory retain early design proposals and should not be treated as proof that a capability is implemented. See the [recovery record](../docs/RECOVERY_CHANGES_2026-09-20.md) for verified behavior.

## Direction

- Keep Daily as a separate module within the main website.
- Generate content before publication; public page requests only read stored issues.
- Prefer structured sources over fragile scraping.
- Keep collection, scoring, clustering, drafting, and publishing in services and CLI entry points.
- Validate external scheduling separately; it was not verified during recovery.

Video, multi-platform publishing, personalized recommendations, comments, search, and multi-author administration are outside the current scope.

## Historical design references

The original planning documents considered RSSHub for feed coverage, Horizon and openclaw-newsroom for workflow ideas, and juya-ai-daily for Markdown/RSS/archive presentation. These are historical research references, not additional installed dependencies.

## Documents

- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [API strategy](API-STRATEGY.md)
- [System design](SYSTEM-DESIGN.md)
- [Historical Prisma schema draft](PRISMA-SCHEMA-DRAFT.prisma)
- [Reference projects](REFERENCE-PROJECTS.md)
