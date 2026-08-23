# 🔨 WebShell Forge

[![CI](https://github.com/s17labs/webshell-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/s17labs/webshell-forge/actions/workflows/ci.yml)

**Build native Android apps locally from plain HTML, CSS, and JavaScript.**

You provide: an app name, a description, an icon, and your code.
WebShell Forge stamps everything into a vendored copy of [s17labs/webshell](https://github.com/s17labs/webshell) — a minimal Android WebView wrapper kit — and runs Gradle locally to produce an installable debug APK.

No cloud build services. No accounts. The generated apps are real Android apps with the `INTERNET` permission already declared, so they can make API calls and load remote content like any other app.

```
┌─────────────────────────────────────────────────────┐
│  Dashboard (browser)  ·  CLI wizard                 │
│    name · description · icon · HTML / CSS / JS      │
│    + live preview before you build                  │
├─────────────────────────────────────────────────────┤
│  forge-core                                         │
│  1. copies the vendored webshell template           │
│  2. stamps applicationId / version into gradle      │
│  3. writes app_name (+ escaped strings.xml)         │
│  4. icon → adaptive launcher icons (all densities)  │
│  5. writes assets/www/ and injects bridge.js        │
├─────────────────────────────────────────────────────┤
│  ./gradlew assembleDebug → dist/*.apk               │
└─────────────────────────────────────────────────────┘
```

## Requirements (for building APKs)

| Item | Version |
|---|---|
| Node.js | 20+ |
| Java | 17+ (AGP 8.7.3 requirement) |
| Android SDK | `platforms;android-35` |

Check your setup anytime:

```bash
npm run forge -- doctor   # or: forge doctor
```

> Scaffolding works without Java/SDK — only the final Gradle build needs them.

## Quick start

```bash
npm install

# Option A — web dashboard (form + live preview + streamed builds)
npm start                     # → http://localhost:4321

# Option B — CLI wizard
npm run forge
```

Both frontends share the same core: they scaffold a project under `projects/`, stream the Gradle build log, and drop the finished APK into `dist/` ready to `adb install` or sideload.

### Using the CLI with existing files

```bash
forge create
# → answers prompts for name/description/icon
# → points it at ./index.html ./style.css ./app.js
# → optionally builds immediately
```

## What gets customized in the template

| File | Change |
|---|---|
| `app/build.gradle.kts` | `applicationId`, `versionCode`, `versionName` |
| `app/src/main/res/values/strings.xml` | `app_name` (quotes/apostrophes escaped safely) |
| `res/mipmap-*` | replaced with adaptive icons generated from your image |
| `app/src/main/assets/www/` | your `index.html`, `style.css`, `app.js` + `app.json` metadata |
| *(untouched)* | `namespace = com.yourapp` and all Kotlin sources — see note below |

**Why no source rewriting:** webshell's docs explicitly allow `namespace ≠ applicationId`. The Kotlin package stays `com.yourapp` while each generated app gets its own unique `applicationId`, so side-by-side installs just work and we never touch fragile code.

The description is stored in `assets/www/app.json` (Android has no native "description" slot) and used for the APK filename.

## Generated apps

- Full-screen WebView loading `assets/www/index.html`
- JS ↔ native bridge via `bridge.js` — auto-injected if missing (`NativeBridge.toast(...)`, vibrate, etc.)
- `INTERNET` + `VIBRATE` permissions pre-declared by the template
- Debug-signed APK → installs on any device (API 26+)

See the upstream docs for the full bridge API:
[bridge-api](https://github.com/s17labs/webshell/blob/main/docs/bridge-api.md) · [gotchas-and-tips](https://github.com/s17labs/webshell/blob/main/docs/gotchas-and-tips.md)

## Building on-device (experimental)

Forge itself is pure Node.js and runs fine on ARM64 phones (Termux / proot environments). Whether the **Gradle build** works there depends on your JVM:

```bash
java -version   # if this fails inside proot, try PROOT_NO_SECCOMP=1 java -version
```

If Java runs, `npm run forge` works end-to-end on-device — expect slow first builds (~5–15 min while Gradle + dependencies download; cached afterwards). If your container blocks JIT memory mapping, builds must run on a desktop until we ship a JVM-free pipeline.

## Building with CI (no local Java needed)

The repo's own CI proves the full pipeline on every push: unit tests, then it scaffolds the sample app from the vendored template and runs `./gradlew assembleDebug` on GitHub-hosted runners. The resulting APK is uploaded as the **`forge-sample-debug-apk` artifact**.

- Download the latest sample APK: **Actions → CI → latest run → Artifacts**
- Rebuild on demand via the workflow's **Run workflow** button (`workflow_dispatch`)

You can also build *your* generated app in CI: scaffold locally (`npm start` or `forge create`), then push/copy the generated `projects/<id>/` folder into any repo and run:

```yaml
- uses: actions/setup-java@v4
  with: { distribution: temurin, java-version: "17" }
- run: ./gradlew assembleDebug --no-daemon
```

## Development

```bash
npm test        # core unit tests (no Java needed)
npm start       # dashboard
npm run forge   # CLI
```

Layout:

```
templates/webshell/    vendored s17labs/webshell @ pinned SHA (.template-version)
packages/core/         scaffolding, stamping, icons (sharp), build runner, env doctor
packages/dashboard/    Express server + zero-dependency browser UI
packages/cli/          @clack/prompts wizard (bin: forge)
test/                  node:test suite
projects/ dist/        local outputs (gitignored)
```

### Updating the vendored template

```bash
git -C templates/webshell pull   # or re-copy from a fresh clone
git rev-parse HEAD > new sha     # update templates/.template-version
npm test                         # stamping patterns are drift-checked by tests
```

## License

MIT © s17 Labs. The vendored `templates/webshell` retains its own MIT license.
