# Gallery 1.1.0: Antigravity → Android Studio

Prepared 12 October 2026 from the Google Drive source archive. This is a
development handoff, with backend deployment and physical-phone acceptance
still outstanding.

## Open the project

Antigravity: open the repository root `Gallery`, or the repository-root
`Gallery.code-workspace`. Start with `docs/ANTIGRAVITY-TASK.md`.

On this VM the prepared root is:

`/home/azureuser/Gallery-handoff-2026-10-12/Gallery`

Android Studio: open **`apps/gallery/android`**, not the root-level `android`
directory. The root `android` directory holds the remote build script. The
native Gradle project has already been generated, including the local Expo
module, and an ignored `local.properties` selects this VM's Android SDK.

Use Java 17, Android SDK 36, Build-Tools 36.0.0, NDK 27.1.12297006, CMake
3.22.1, and the generated Gradle 8.14.3 wrapper. On another computer, run:

```bash
cd apps/gallery
corepack pnpm install --frozen-lockfile
corepack pnpm android:prepare
```

Then select that computer's SDK location in Android Studio. Its first Gradle
sync may download native dependencies. Sync/run in the visible IDE has not
been verified by this handoff. Antigravity's window title confirms the
prepared workspace and handoff document are open. Android Studio currently
shows its Welcome screen; use Open and select the generated project folder.

## Development and phone testing

For a local indexing debug session, run Metro from `apps/gallery`:

```bash
corepack pnpm native:start
```

For an authorized USB device, `adb reverse tcp:8081 tcp:8081` makes the
VM's Metro available. A development debug build needs Metro. The separately
downloaded `gallery-phone-test.apk` contains its JavaScript and is a different
artifact: version 1.1.0/code 2, signed with an Android debug certificate.

The source release workflow uses Limrun:

```bash
bash android/build-client.sh
```

An empty service origin supports phone-local indexing tests. Before hosted
integration, build with the real operator-owned HTTPS origin as the first
argument. Never substitute a sample hostname or public Ollama port. The
provided APK's handoff says no hosted service origin was supplied. Treat it
as a local phone test, not a production-connected release. Preserve signing
identity when upgrading an installed app, and establish private production
signing separately.

## What is implemented

Selected phone folders use Android's Storage Access Framework. Only metadata
is indexed; original contents stay on the phone. Metadata records remain
source occurrences rather than SHA-256-verified canonical assets. Rescans,
manual tags, sorting, filename/path/tag search, safe-area layout, and persisted
appearance are implemented. No continuous background service is promised.

Google Drive metadata access and the operator-approved model catalogue are
present. Model selection does not implement inference. AI tagging, grounded
answers, full canonical ingestion, semantic/hybrid search, annotation sync,
and cross-device session recovery remain backend work.

## Verification in this run

- Frozen pnpm 9.12.0 installation passed with Node 24.21.0.
- TypeScript passed; 37 app tests passed.
- ESLint: zero errors, five inherited warnings.
- Node API bundle passed.
- Fresh Android JavaScript/Hermes and static web exports passed.
- Python 3.12 Analysis/Search/integration: 73 tests passed.
- Expo Android prebuild passed. Autolinking resolves `GalleryLocalIndexModule`.
- Downloaded APK signature verifies, package/version matches 1.1.0/code 2,
  and SHA-256 matches the Drive metadata and release handoff.

The Drive release handoff records earlier remote native compilation and
emulator acceptance. Those tests were not repeated here. This run generated
the native project without compiling it. Physical Samsung acceptance, live
Google consent, production HTTPS/database/OAuth configuration, and private
Ollama inference remain pending. Test logs and comparison evidence are in
the original handoff's adjacent `evidence` directory. Source comparison
metadata and the two backend branch patches are also checked in under
`docs/source-comparison`. The portable launchers in `scripts/ide` target
this VM's installed IDEs; use the IDE's Open command on another machine.

## Source control and unique backend work

This isolated checkout starts at GitHub main `ca429ff9951ecd601ae274db4fc20af6d4a8f11d`,
on branch `codex/drive-client-1.1.0`, containing the Drive client and this
handoff. The user authorised committing and publishing the prepared branch.
Original Drive objects and existing VM checkouts were preserved.

Drive contains all 152 tracked files from main: 133 are identical, 19 changed.
It adds 21 source/handoff/deployment files and 12 generated Python egg-info
files. The generated egg-info files were excluded from this prepared source.
Dependency installation may recreate ignored package metadata locally.

Drive is the latest client, but not a superset of all backend development:

- GitHub `gallery/catalogue-checkpoint`, `033d514b73aa51216ee976604f402227eb2fe215`,
  has `services/catalogue` and tests absent from Drive.
- VM branch `feat/gallery-selective-pr20-port`, `c4be3da3b1ce99d59922ca5e1733160e92c0f861`,
  has catalogue/cache/import, source, Search, and private Ollama boundary
  implementations absent from Drive. Its directory is
  `/home/azureuser/worktrees/Gallery/gallery-selective-pr20-port`.

Full comparisons and patches are preserved in `docs/source-comparison`. Review these
two approaches for overlap and contract compatibility before integrating.
Do not apply both patches automatically or discard the 1.1.0 phone client.

## Hosting handoff

AWS remains the selected target, profile `ollamabinsaden`, Region
`ap-southeast-2`. Antigravity is the development IDE. It does not itself host
the API, database, Analysis/Search workers, or private Ollama runtime.

Deployment templates are supplied in `deploy/aws`, but `setup-ec2.sh` changes
system packages, users, database state, and services. It has not been run.
Before using it, verify the intended host and AWS project coverage/costs;
configure a stable authenticated HTTPS origin, server-only secrets, OAuth
callback/return origins, approved models, and storage/recovery. Keep all
credentials, grants, runtime databases, and release keystores outside Git.

Use the complete source tree for backend preparation: the small
`Gallery-deployment.zip` is only scripts/templates and the release handoff.
