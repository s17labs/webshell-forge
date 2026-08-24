# AGENTS.md

Guidance for AI coding agents (OpenCode, Claude Code, etc.) working in this repository.

## Project Overview

WebShell Forge builds native Android APKs locally from plain HTML/CSS/JS: it scaffolds a vendored
copy of s17labs/webshell, stamps app identity into the Gradle project, injects web assets, and
drives `gradlew assembleDebug` — exposed as an interactive CLI and a local web dashboard.

- Language/stack: Node.js >= 20, plain ESM JavaScript (ES modules, `"type": "module"`, no
  TypeScript), npm workspaces; `sharp` for icon generation, `@clack/prompts` for CLI, Express 5
  for the dashboard
- Package/module: root `webshell-forge` with workspace packages `@s17labs/forge-core`,
  `@s17labs/forge-cli`, `@s17labs/forge-dashboard`
- Toolchain: Node >= 20 (CI uses Node 22); Java/JDK 17 only needed to actually assemble an APK
- Author/maintainer: yungsamd17 (https://github.com/yungsamd17)

## Build & Verify

```bash
npm test                  # unit tests (node:test runner, no Java needed)
npm run sample            # e2e scaffold: creates projects/sample via scripts/e2e-scaffold.mjs
node packages/cli/src/index.js   # run the CLI (also `npm run forge`)
```

- There are no separate build/lint scripts — the library runs directly from source.
- CI (`.github/workflows/ci.yml`) has two jobs on every push to `main`, PRs, and manual dispatch:
  1. `test`: Node 22, `npm ci`, `npm test`.
  2. `build-apk` (needs `test`): JDK 17 temurin + Node 22, scaffolds a sample app with
     `node scripts/e2e-scaffold.mjs projects/sample`, greps the output to verify stamping
     (applicationId, app_name, assets), then runs `./gradlew assembleDebug --no-daemon` inside
     `projects/sample` and uploads the APK artifact.
- Local sandboxes often lack JDK/the Android SDK — unit tests still run anywhere with Node;
  let CI verify actual APK assembly if Gradle can't run locally.

## Architecture

```
packages/
  core/                   # @s17labs/forge-core — engine everything else calls
    src/index.js          # public API: createApp() = scaffold -> stamp -> www -> icon; re-exports all modules
    src/scaffold.js       # copies templates/webshell into a fresh output dir
    src/stamp.js          # stamps name/applicationId/version into build.gradle.kts + strings.xml
    src/www.js            # writes index.html/style.css/app.js/app.json into assets/www
    src/icons.js          # generates launcher icons from a source image (sharp)
    src/build.js          # buildApp(): spawns ./gradlew assembleDebug; copyApk()
    src/export.js         # exportRepo(): emits a CI-ready repo with a baked-in APK workflow
    src/util.js           # derivePackageId, slugify, apkSlug, version normalization
    src/zip.js / doctor.js / paths.js   # zipping, environment checks, template dir + version
  cli/                    # @s17labs/forge-cli — interactive terminal UX (@clack/prompts, bin: forge)
  dashboard/              # @s17labs/forge-dashboard — local Express server + public/ form & live preview
templates/webshell/       # vendored copy of s17labs/webshell, pinned in templates/.template-version
scripts/e2e-scaffold.mjs  # end-to-end sample generator used by CI and `npm run sample`
test/run.js               # node:test suite (runs core directly from source)
dist/, projects/          # local build outputs and scaffolds — gitignored, never committed
```

Key patterns:

- Cross-package imports use workspace names (`import ... from '@s17labs/forge-core'`);
  `core` must stay free of CLI/dashboard dependencies.
- The Android template is vendored, not fetched: `templates/.template-version` records the
  source repo, pinned commit SHA, and vendor date; `test/run.js` asserts a 40-char SHA exists.
  Update webshell behavior by re-vendoring and bumping this file — don't hand-patch copies.
- `createApp()` cleans up after itself: if any step throws, the scaffolded project directory is
  removed before the error propagates.
- Identity stamping is asymmetric by design: `applicationId` is derived/stamped per app, while
  `namespace` intentionally stays `com.yourapp` (tests assert both).
- Web asset handling: `bridge.js` is injected into `index.html` when missing and left untouched
  when already present; user HTML/CSS/JS lands verbatim in `assets/www/`.

## Commit Messages

Format: `type(scope): short imperative summary` — lowercase after type, no trailing period.
Keep commits atomic — one logical change per commit.

| Type | Use for |
|---|---|
| `feat` | new user-facing feature |
| `fix` | bug fix |
| `refactor` | code change that neither fixes nor adds behavior |
| `style` | formatting/UI polish without logic change |
| `test` | adding or fixing tests |
| `docs` | documentation only |
| `chore` | build, deps, CI, tooling |
| `release` | version bump / release tagging |

Scope is a short area name for this project (e.g. `core`, `cli`, `dashboard`, `template`,
`test`, `ci`). Use plain `type:` only when a change genuinely spans everything (rare).

Examples:

```
feat(core): add exportRepo command
fix(cli): handle cancel prompt in export flow
chore(ci): cache gradle wrapper in e2e job
docs(readme): document dashboard endpoints
```

## Agent Guardrails

- Never commit or push directly to `main`; all changes land through pull requests.
- Never open a PR unless the developer explicitly asks for it.
- One concern per change. If the description says "also", split it into another branch/PR.
- Do not commit secrets or local-only files: `node_modules/`, `projects/`, `dist/`, logs are
  gitignored — keep them out of commits.
- Never edit files inside a generated project (`projects/*`) expecting them to persist; they are
  disposable build artifacts. Changes belong in `templates/` + `core` stamping logic.
- When watching CI/bot feedback on your PRs: poll checks and comments newer than the last push,
  verify each bot finding against the source before "fixing" it, dismiss false positives with a
  written reason, and stop when checks are green on the latest commit.

## Pull Requests

All changes land on `main` through pull requests.

1. Create a branch off `main`: `<type>/<short-description>` (e.g. `feat/core-export-command`).
2. Commit there using the format from **Commit Messages**; keep commits atomic.
3. Push the branch and open a PR against `main`.

PR rules:

- One feature/fix per PR — small and focused beats large and thorough.
- Title follows the commit message format: `type(scope): short imperative summary` —
  it becomes the squash-merge commit message.
- Body stays concise, following the PR template: what changed and why, bullet list of touched
  areas, evidence if applicable, testing checklist (tick before merge).
- End the body with an AI attribution line stating exactly which model and agent made the changes,
  in this exact format:

  ```
  Built with {model} in the {agent} harness.
  ```

  Example: `Built with ox-alpha in the OpenCode harness.`

- Do **not** put AI attribution in GitHub Release notes — releases stay clean.
- CI must pass before merging.

## Gotchas

- Everything is ESM — always use `import`/`export`; top-level `await` is fine (the test file
  relies on it). No CommonJS `require`.
- Icon stamping failures abort `createApp` unless `tolerateIconErrors` is set; the dashboard sets
  it so builds degrade gracefully instead of failing.
- APK filenames follow `<slug-of-name>-v<versionName>-debug.apk` (see `apkSlug`) — keep the
  pattern consistent when touching build/copy code.
- Unit tests deliberately avoid Java; if you add a test that shells out to Gradle, put it behind
  the e2e path instead of `test/run.js`.
