# PixelDrive Evaluation Notes

## Scope of the submission

The repository contains a working Expo mobile client plus a Node/Express server for direct, read-only Google Drive connections. It is designed as a **view and virtual-organisation layer**, not a Drive file manager. Connected source files stay in their original Drive locations and no Drive-write endpoints are implemented.

| Requirement | Evidence in the repository |
|---|---|
| No hardcoded Google Studio dependency | `app/(tabs)/index.tsx` provides deterministic fixture retrieval. Google Drive code is for source viewing only. |
| No user-provided GenAI key required | Fixture retrieval, search, review, and duplicate behaviours run locally. Ollama is intentionally not configured. |
| Multiple simultaneous Drive sources | `google_drive_sources` stores device owner key plus Google account identity; `googleDrive.allFiles` aggregates all connected sources. |
| Read-only source access | The app requests `drive.readonly`; server routes contain listing and media proxy operations only. |
| Image, video, and file viewing | `Images` renders source images, `DriveVideo` uses `expo-video`, and ordinary files expose a view-only Google Drive link. |
| Mobile UI quality | The app uses five primary destinations; Reviews and Duplicates are secondary Library screens; Android filter chips use fixed height and centred labels to prevent clipping. |

## Automated checks

Run the following from repository root:

```bash
pnpm lint
pnpm test
pnpm check
```

The automated suite covers deterministic archive retrieval, filtering, manual categorisation, review decisions, duplicate preference, and OAuth state integrity. OAuth client validation runs live only when its credentials are supplied through environment secrets. The suite intentionally does not automate an interactive Google account consent screen.

## Manual OAuth checks

The deployed evaluator must provide Google OAuth credentials through environment secrets and configure the callback URL and `drive.readonly` consent scope as described in the root README. Verify that the connection action opens Google consent directly; it should not invoke the retired template identity flow. Connect two accounts to validate independent sources, then open an image, a video, and a document from each source.

## Known follow-on work

Ollama-backed classification, semantic retrieval, and sorting remain pending because no endpoint, model identifier, or authentication scheme has been supplied. This is deliberately separated from the evaluation-critical archive viewer so the repository remains usable without a GenAI API key.
