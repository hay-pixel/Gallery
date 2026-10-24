# Gallery in Android Studio

> This document records the earlier 1.0.0 setup and checks. For the prepared
> Drive 1.1.0 project, current paths, local indexing behavior, and verified
> limits, use [IDE-HANDOFF.md](IDE-HANDOFF.md). The 1.1.0 release workflow uses
> `android/build-client.sh` with Limrun; generating an Android Studio project
> does not constitute a new native build.

Gallery is an Expo SDK 54 / React Native 0.81.5 application with a separate
Node API. Android Studio builds the native client; it does not run the API,
MySQL, Analysis, Search, or Ollama.

## Prepare a checkout

Use Node 22 or later, Corepack with the project's pinned pnpm 9.12.0, JDK 17,
and Android Studio. In Android Studio's SDK Manager install Android SDK Platform
36, Build-Tools 36.0.0, Platform-Tools, NDK 27.1.12297006, and CMake 3.22.1.
The generated Gradle wrapper uses Gradle 8.14.3; use the wrapper rather than a
separately installed Gradle. Keep `ANDROID_HOME` pointing at your SDK directory.

From the repository root:

```bash
cd apps/gallery
corepack pnpm install --frozen-lockfile
corepack pnpm android:prepare
```

Open **`apps/gallery/android`** in Android Studio, then allow Gradle sync.
On this machine the full path is:

```text
/home/azureuser/worktrees/Gallery/Gallery/apps/gallery/android
```

Set the Gradle JDK to Java 17 in Android Studio's Gradle settings. This checkout
has an ignored `android/local.properties` pointing to
`/home/azureuser/Android/Sdk`; another machine needs its own SDK path. Both ARM
phone and x86 emulator architectures are enabled in `app.config.ts`.

The generated `android/` directory is deliberately ignored. Commit native
configuration through `app.config.ts` or config plugins, then run
`android:prepare` again. A fresh clone needs dependencies and prebuild before
Android Studio can open it. Avoid `prebuild --clean` if you have native edits to
preserve.

## Run in Android Studio

Use an emulator or a USB-connected Android device with USB debugging enabled.
The minimum Android version is Android 7.0 / API 24.

For development on the same machine, forward both API and Metro ports to the
device. These commands work for an emulator or an authorized USB device:

```bash
adb devices
adb reverse tcp:3100 tcp:3100
adb reverse tcp:8081 tcp:8081
```

If multiple devices are connected, use `adb -s DEVICE_SERIAL reverse ...`.
Repeat forwarding after a device reconnect. Run Metro from `apps/gallery`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3100 corepack pnpm native:start
```

In Android Studio select the **app** configuration and **debug** variant, then
press Run. A debug APK loads JavaScript from Metro, so keep that terminal open.
Alternatively, this command compiles and launches the native app and starts
Metro:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3100 corepack pnpm android --device
```

Run the API separately in another terminal, with its configuration injected:

```bash
cd apps/gallery
PORT=3100 corepack pnpm dev:server
```

These examples use port 3100 because port 3000 is already occupied on this
machine. Use a free API port and forward that exact port if development falls
back from 3100. Check `/api/health` before diagnosing client networking.

An emulator can instead use `http://10.0.2.2:3100` to reach the host API without
API port forwarding. A physical phone cannot use that address. For a phone
away from USB, configure a reachable HTTPS API origin and rebuild/reload the
client. `EXPO_PUBLIC_*` values are bundled client configuration, not secrets.
Local HTTP is allowed by the debug manifest; use HTTPS for a release.

## What needs a backend

The sample catalogue, deterministic sample search, and local review decisions
are available for UI evaluation. These are fixture records, not an import of
the phone's library or a connected Drive catalogue.

Live Google Drive needs the separate API, MySQL and reviewed migrations,
`DATABASE_URL`, a stable private `JWT_SECRET`, and a dedicated Google Web OAuth
client configured with `GOOGLE_DRIVE_OAUTH_CLIENT_ID` and
`GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`. Register exactly
`<API-origin>/api/google-drive/callback` with Google. The browser must reach
that API origin too. The native app return URI is
`ollamabinsaden-gallery://oauth/drive`; the server already accepts it. Native
clients do not require `EXPO_PUBLIC_GALLERY_RETURN_ORIGIN`, which is for web.
Google testing mode requires designated test users.

Keep server configuration in secure runtime injection or ignored local files.
Never put database credentials, JWT secrets, Google client secrets, refresh
tokens, or Ollama credentials in public Expo variables or Git.

Real catalogue ingestion, filesystem/device source adapters, full
metadata/semantic/hybrid Search, durable Analysis integration, and the private
Ollama adapter remain milestones in the root README. Cross-device account
recovery is also unfinished. Android Studio setup does not complete them.
Clients must call the Gallery API; Ollama port 11434 stays private. AWS is the
planned deployment target in `ap-southeast-2`; deployment is separate work.

## Builds and release

For a limited two-architecture local build:

```bash
cd apps/gallery/android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2 --no-daemon
```

The debug APK is `app/build/outputs/apk/debug/app-debug.apk`. It requires Metro;
it is a development artifact rather than a standalone phone release.

Before distribution, configure a private release signing key outside Git,
increment `version` and Android `versionCode`, bundle against the intended
HTTPS API, and test the resulting release on a real device. Expo's generated
template uses the debug signing configuration for release too; replace that
for distribution. Preserve the existing signing identity if upgrading an
installed app. Earlier monorepo APKs are not evidence for this checkout.

Existing CI covers app checks/tests/server build and Python services. Native
compilation and device acceptance need separate evidence. Verify installation,
launch, navigation, local persistence after restart, Drive consent and return,
media access, offline behavior, and background/resume behavior before calling
the app phone-ready.

References: [Expo local native builds](https://docs.expo.dev/guides/local-app-development/),
[React Native 0.81 environment setup](https://reactnative.dev/docs/0.81/set-up-your-environment).

## Local verification, 2026-10-11

- Frozen pnpm 9.12.0 dependency installation: passed.
- `corepack pnpm check`: passed.
- `corepack pnpm test`: 9 files / 22 tests passed.
- `corepack pnpm exec eslint .`: 0 errors, 5 existing warnings.
- `corepack pnpm build`: separate Node server build passed.
- `corepack pnpm android:prepare`: native Android project generated.
- Android Expo export / Hermes bundle: passed, 1,547 modules.
- `./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2 --no-daemon --console=plain`:
  passed, 322 executed tasks, 10m 57s on the first build.
- `apksigner verify --verbose`: passed, APK v2 signature verified.
- APK inspection: `com.ollamabinsaden.gallery`, version 1.0.0 / code 1,
  minimum SDK 24, target/compile SDK 36, ARM64 and x86_64 libraries.
- Generated SDK settings, debug keystore, APK, and bundle output are ignored
  by Git; `git diff --check` passed.

APK: `apps/gallery/android/app/build/outputs/apk/debug/app-debug.apk` (111 MiB).
SHA-256: `ab90e0b24b499a0691848ea349e39f54e0cd51b896e8868b1547790601ac1be5`.

This is a debug-signed development build requiring Metro. No ADB device was
connected. Installation, launch/UI, Android Studio's visible sync/run, live
Drive OAuth, database connectivity, phone networking, and background/resume
behavior were not verified. No production release or AWS deployment was
performed. Native dependencies emit deprecation warnings; keep the generated
Gradle 8.14.3 wrapper for this SDK rather than upgrading it independently.
