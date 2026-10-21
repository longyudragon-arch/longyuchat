# GitHub Synchronization — 2026-10-21

## Requested outcome

Publish the completed recovery branch to GitHub and translate the repository-facing Chinese text shown in the repository screenshot into English. The owner explicitly approved rewriting the old Chinese commit title after being informed that descendant commit IDs and existing remote branch history would change.

## Branches and documentation

- Publish `codex/project-recovery-20260920` with the existing recovery fixes and verification coverage.
- Translate the recovery README, agent guidance, Daily module overview, project overview, and original MVP specification into English.
- Translate the default `main` branch README and agent guidance while preserving that branch's existing MVP application code.
- Keep detailed historical audits and operational records in their original language.
- Preserve application UI strings and behavior as part of this documentation/synchronization task.

## Historical commit title

Replace the Chinese subject of commit `d75e8a4d8f7f30e0c216fa38b2058ca7cf7a4da1` with:

> Establish the multi-model chat MVP

The old commit is shared by all nine existing remote branch heads. Its descendants need new IDs even though the historical file contents remain identical. No old commit is dropped or reordered.

## Method and safety checks

1. Save the original remote refs and create a verified full Git bundle before rewriting.
2. Create a separate mirror clone and use `git-filter-repo` 2.47.0 for the message replacement.
3. Disable empty/degenerate commit pruning and automatic replacement of SHA mentions in messages, keeping the change limited to the approved title and resulting parent IDs.
4. Verify every mapped commit's tree, author, committer, timestamps, parent order, and message; only the approved subject may change.
5. Add the English default-branch documentation as a separate commit.
6. Push exactly the intended branch refs atomically with an explicit expected old SHA for each existing branch; require the new recovery branch to be absent.
7. Fetch and verify the published refs and English files after the push.

A private local bundle, reference inventory, old-to-new commit map, and rollback instructions are retained outside the published application files. Do not commit or upload that backup directory.

## Verification

The recovery branch passed ESLint, full TypeScript checking, 316 tests across 44 files, a production build, browser smoke checks, and ten production smoke checks. These checks use synthetic provider fixtures and isolated test databases; they do not prove live credentials, production deployment, or external scheduling.

English entry documents were checked for Chinese text, broken local Markdown links, and accidental private-file inclusion before commit. Publication includes only intended source, tests, and documentation; local environment files, runtime databases, and backups stay excluded.

## Working with the rewritten history

Commit SHA values in older audit documents identify pre-rewrite snapshots. Use the private commit map to resolve them. The active recovery worktree is aligned with its rewritten published branch. Other existing local worktrees retain their original files and local history, so they may need deliberate reconciliation before a future push. Do not merge the old history back into GitHub.

History translation does not remove historical credential exposure. Credential rotation, the migration checksum discrepancy, provider DNS binding, and dependency advisories remain separate recovery concerns documented in the earlier audit.

## Tool references

- [git-filter-repo documentation](https://github.com/newren/git-filter-repo/blob/main/Documentation/git-filter-repo.txt)
- [Git filter-branch warning and alternative](https://git-scm.com/docs/git-filter-branch)
- [Git push: explicit force-with-lease and atomic updates](https://git-scm.com/docs/git-push)
