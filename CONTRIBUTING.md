# Contributing

Thank you for taking the time to contribute! This document explains how to get started, what the workflow looks like, and what conventions to follow.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Branch & Commit Conventions](#branch--commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Adding a New Adapter](#adding-a-new-adapter)
- [Build Budgets](#build-budgets)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to abide by its terms.

---

## How to Contribute

| Type | Steps |
|------|-------|
| Bug report | Open an [issue](https://github.com/jhonsferg/ngx-streaming-player/issues/new?template=bug_report.yml) using the bug template |
| Feature request | Open an [issue](https://github.com/jhonsferg/ngx-streaming-player/issues/new?template=feature_request.yml) using the feature template |
| Documentation | Fork, edit, open a PR |
| Code fix / feature | Fork, branch, code, test, open a PR |

---

## Development Setup

**Requirements:** Node.js >= 18, npm >= 9

```bash
# 1. Fork and clone the repo
git clone https://github.com/<your-fork>/ngx-streaming-player.git
cd ngx-streaming-player

# 2. Install dependencies
npm install

# 3. Start the showcase with the library in watch mode
npm start

# 4. Build the library alone
npm run build:lib

# 5. Type-check without emitting
npm run type-check

# 6. Lint
npm run lint
```

---

## Branch & Commit Conventions

### Branch names

```
feat/short-description
fix/short-description
docs/short-description
refactor/short-description
chore/short-description
```

### Commit messages

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via Commitlint + Husky:

```
<type>(<scope>): <subject>

Types : feat | fix | docs | style | refactor | test | chore | perf | ci
Scopes: lib | showcase | adapters | controls | providers | tokens | models
```

Examples:

```
feat(adapters): add WebRTC adapter
fix(lib): prevent PiP request before loadedmetadata
docs(showcase): add WebRTC example to playground
```

---

## Pull Request Process

1. Keep PRs focused - one logical change per PR.
2. Update `CHANGELOG.md` under an `[Unreleased]` section.
3. Make sure `npm run lint` and `npm run type-check` pass before opening the PR.
4. Make sure `npm run build:lib` and `npm run build:showcase` pass.
5. Fill in the PR template completely.
6. A maintainer will review, request changes if needed, and merge.

---

## Adding a New Adapter

1. Create `projects/ngx-streaming-player/src/lib/adapters/<protocol>/<protocol>.adapter.ts`
2. Implement `IPlayerAdapter` (all methods are required)
3. Add detection logic in `player.service.ts` - `detectProtocol()` and `createAdapter()`
4. Wire up state events (play, pause, timeupdate, ended, error, quality, subtitles)
5. Export from `src/public-api.ts` if consumers need to inject it directly
6. Add at least one example in the showcase app
7. Document in `README.md` under Protocol Support and API Reference

---

## Build Budgets

The showcase app enforces these Angular build budgets:

| Budget | Warning | Error |
|--------|:-------:|:-----:|
| `initial` (total JS + CSS) | 3 MB | 5 MB |
| `anyComponentStyle` | 40 kB | 80 kB |

Keep component stylesheets lean. Large third-party imports belong in lazy-loaded chunks.
