# CineHunt local patch: Floating AI Chat + Full-Stack CI/CD

## Local first

Run dry-run (no changes):

```bash
python3 "$HOME/Downloads/CineHunt-Chatbox-CICD-Local-v1.py" --repo "$(git rev-parse --show-toplevel)"
```

If DRY RUN PASS, apply (backups in ~/Downloads):

```bash
python3 "$HOME/Downloads/CineHunt-Chatbox-CICD-Local-v1.py" --repo "$(git rev-parse --show-toplevel)" --apply
```

## Local mobile verification

```bash
cd "$(git rev-parse --show-toplevel)/mobile"
npm run typecheck
npm run lint:active
npm test
npx expo-doctor
```

## Git / Docker review (no push)

```bash
cd "$(git rev-parse --show-toplevel)"
git diff --check
git status --short
git diff --stat
```

Avoid running Docker builds on a memory-constrained Mac. GitHub Actions CI jobs run on hosted runners after the user explicitly pushes the patch to GitHub. CD is manual, publishes images to GHCR and DOES NOT deploy or touch SQL Server.

### What changed

- Floating CineHunt AI button on the four main tabs. Hidden on login, seat selection, booking and payment.
- Modal chat keeps conversation while switching tabs, supports retry, input limit and backend's POST /chat.
- Discover retains GPS, movies, favorites, combos and recommendations; only inline AI chat is removed.
- CI: backend, admin-web, mobile, recommendation service. Default CI deliberately excludes SQL migration/integration.
- CD: manual publish of three Docker images after CI succeeds. No deployment, migration, credentials or secrets in source.
- Existing `mobile-checks.yml` remains unchanged. It may run alongside the new full-stack workflow on PRs.

### Important validation limit

The patch validates file anchors and can be dry-run locally. A syntax/transpile check is not the same as a full TypeScript typecheck or running the UI on a real iPhone. The chat and CI/CD must be validated on the user's checked-out code, and CI jobs need one real GitHub-hosted run before claims of success.
