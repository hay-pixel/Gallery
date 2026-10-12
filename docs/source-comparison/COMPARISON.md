# Gallery comparison — 12 October 2026

**The Google Drive 1.1.0 archive is the newest client compared with GitHub
main and the located VM checkouts. It is not the most complete combined
backend version.** Backend development exists on two separate branches.

## Compared copies

| Copy | Observed state | Conclusion |
|---|---|---|
| [Drive: Ollama/Gallery](https://drive.google.com/drive/folders/1RIQuhvKkWvNE0amUP5z5JucP2lHW1dtb) | Source, deployment templates, handoff, and phone APK updated 12 October, about 09:22 UTC; client 1.1.0/code 2 | Latest client baseline |
| [GitHub main](https://github.com/hay-pixel/Gallery/tree/main) | `ca429ff9951ecd601ae274db4fc20af6d4a8f11d`, 11 October; client 1.0.0/code 1 | Behind Drive's client |
| VM `/home/azureuser/worktrees/Gallery/Gallery` | Clean at the same `ca429ff` as live GitHub main | Same client as GitHub |
| VM `/home/azureuser/repo/Gallery` | Clean at `dc2fdd247a64c352c0f71966a61b16f388d6363e`, 9 October | Three main-branch commits behind current GitHub |
| VM `Documents/Codex/2026-10-10/se/work/Gallery-ready` | Clean at `64e887ba474ff55c196935a7726d89997db73bee`, 11 October | One main-branch commit behind current GitHub |
| [GitHub catalogue checkpoint](https://github.com/hay-pixel/Gallery/tree/gallery/catalogue-checkpoint) | `033d514b73aa51216ee976604f402227eb2fe215`, 9 October | Contains catalogue service/tests absent from Drive/main |
| VM `/home/azureuser/worktrees/Gallery/gallery-selective-pr20-port` | `c4be3da3b1ce99d59922ca5e1733160e92c0f861`, 7 October, plus an untracked readiness note | Contains catalogue/cache/import, source, Search and private Ollama boundary work absent from Drive |
| Historical monorepo VM Gallery branches | `e4e2a356ce123762c00ea5308a2dcffc81b01289` and PR20 reference `2ab68bab8fe7b26d4f824260de29b24e8c4b3d8e`, September | Earlier lineage; standalone Gallery supersedes it |
| Drive `Ollamabinsaden/Gallery` | September APKs including 1.0.4 and preview builds | Historical artifacts, different code/version lineage |
| Drive historical `gallery` source folders | August monorepo-era folders | Older than current standalone archive |
| Other connected Drive search | September Android finalisation plans and unrelated Samsung Gallery data | No newer Gallery app source found in those results |

## Content comparison

The downloaded `Gallery-main.zip` has no Git history. This conclusion is
based on source content, app version, archive metadata, and live GitHub ref
verification, not an assumption that upload timestamps prove Git ancestry.

Against current GitHub main's 152 tracked files:

- 133 files are byte-identical.
- 19 files changed.
- No tracked main file is missing.
- 33 files were added: 21 source/deployment/handoff files and 12 generated
  Python egg-info files. The prepared source excludes those generated files.

The new client includes an Android local indexing module, persisted tags,
metadata search/sorting, refreshed light/dark UI, session/request changes,
and an operator-approved model catalogue. Python Analysis/Search and accepted
contracts remain the same as main. The catalogue checkpoint has eight files
absent from Drive; the selective-port branch has 29. Their changed shared
files also require review. See `docs/source-comparison/comparison.json`,
`docs/source-comparison/backend-branches.json`, and the two saved branch patches.

The Drive deployment ZIP is only 8.7 KB and is not the full application.
Backend preparation must use the complete source tree plus its templates.

## Prepared result

The complete Drive source is overlaid on an isolated local Git branch
`codex/drive-client-1.1.0` based on verified GitHub main, at:

`/home/azureuser/Gallery-handoff-2026-10-12/Gallery`

Source changes are a reviewable working diff. At initial comparison, no commit, push, merge, or
cloud deployment had been performed. The user subsequently authorised
committing and publishing this prepared source on its branch. Original checkouts and Drive objects were
preserved. The folder includes updated status documentation and a concrete
Antigravity handoff; `apps/gallery/android` is generated for Android Studio.
Dependencies are installed, Java 17 and Android SDK 36 are present, and the
local native module resolves through Expo autolinking.

Antigravity workspace: repository-root `Gallery.code-workspace`. Android Studio project:
`Gallery/apps/gallery/android`. Convenient VM launchers are
`scripts/ide/open-antigravity.sh` and `scripts/ide/open-android-studio.sh`.

## Fresh verification

- Frozen dependency installation and TypeScript passed.
- 37 app tests and 73 Python Analysis/Search/integration tests passed.
- Node API bundle passed; ESLint has zero errors/five inherited warnings.
- Android native project generation passed, with the custom module resolved.
- Fresh Android JavaScript/Hermes export and static web export passed.
- Downloaded APK: package `com.ollamabinsaden.gallery`, version 1.1.0/code 2,
  minimum API 24, target API 36. Signature verification passed. It is signed
  with an Android debug certificate, for testing.
- APK size: 93,138,866 bytes. SHA-256:
  `f2ab9fb9acf0505960c877e13585d8e80e60676ef1963bcc5f50e95765185472`.
- Both archive hashes and APK hash match Drive's supplied hashes.

The Drive handoff records previous Limrun native compilation and emulator
acceptance. This run did not repeat native compilation or emulator tests.
Native source generation is distinct from Android Studio Gradle sync/run.
The Antigravity IDE window title confirms `Gallery (Workspace)` with
`ANTIGRAVITY-TASK.md` open. Android Studio's open request was issued, but its
observed window remains at the Welcome screen. Open the generated project
folder there; Gradle sync/run and app acceptance have not been confirmed.

## Remaining deployment/acceptance work

No operator HTTPS service origin has been supplied. Live Google consent,
database/session recovery, private model runtime and grounded inference,
complete canonical ingestion/search integration, and physical Samsung
acceptance remain outstanding. The APK supports local indexing tests; it
is not a completed hosted production release.

Use Antigravity for development and backend reconciliation, then Android
Studio for native development. AWS hosting remains a separate step in
`ap-southeast-2` after project service/cost checks and deployment review.
Keep runtime credentials and signing keys outside Git.
