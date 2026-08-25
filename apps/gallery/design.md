# PixelDrive Mobile Design Plan

## Product intent

PixelDrive is a **single-user, read-only universal library** for Google Drive originals. It supplies a private catalogue and organisation layer without ever moving, renaming, deleting, or overwriting the source archive. The Expo implementation will retain the source application’s dark, blue-accented mobile-first visual language and its existing information architecture rather than redesigning its product experience.

## Mobile layout principles

The app is designed for **portrait 9:16 use** and one-handed operation. Primary navigation stays at the bottom, primary actions remain in thumb-reachable bottom areas or within cards, and detailed metadata appears in bottom sheets or modal overlays. Cards, category chips, and compact status rows mirror the existing Compose structure while following iOS-safe areas, legible type sizes, and minimum touch-target expectations.

## Screen list

| Screen | Primary content and functionality |
|---|---|
| Home | Archive summary, category counts, recent/featured files, duplicate and review signals, plus shortcuts to core flows. |
| Library | Universal mixed-media grid/list with category chips, file-type context, file cards, and file-detail access. |
| Search | Fast catalogue search across fixture filename, path, category, tags, OCR-like extracted text, and descriptions. |
| Ask AI | Conversational, grounded retrieval over catalogue records with sample prompts, a message thread, citation chips, and tappable file cards. No user-provided GenAI key is required. |
| Review | Needs Review cards with suggested categories, evidence, confidence, and Approve, Change Category, and Skip actions. |
| Duplicates | Exact/likely duplicate groups, evidence, comparison entry point, and non-destructive preferred-copy selection. |
| System | Pipeline/job status for source scan, metadata, hashing, previews, OCR, classification, indexing, and errors/retry controls. |
| File detail sheet | Preview, provenance, metadata, tags, extracted text, observations, duplicate/review state, and safe virtual-organisation actions. |
| Category editor sheet | Category-selection control for a file; manual choices remain authoritative in the local catalogue. |
| Duplicate comparison sheet | Side-by-side metadata/evidence for a selected duplicate group with no source-destructive actions. |

## Key user flows

| Flow | Steps |
|---|---|
| Browse a file | Home or Library → category filter or file card → File detail sheet → inspect metadata/provenance or open the immutable original link. |
| Search the library | Search tab → enter terms → relevance-ranked file cards → File detail sheet. |
| Ask the archive without an API key | Ask AI tab → choose a prompt or enter a question → deterministic catalogue retrieval ranks matching records → grounded response template and file citations → tap a citation for the detail sheet. |
| Resolve a review item | Review tab → inspect suggested category and evidence → Approve, Change Category, or Skip → local review state updates immediately. |
| Inspect duplicates safely | Duplicates entry point → choose a group → comparison sheet → mark preferred copy only → close without changing any source file. |
| Monitor the pipeline | System tab → inspect local fixture job progress/status → trigger or retry a simulated safe job state without modifying Google Drive originals. |

## Colour choices

| Token | Value | Purpose |
|---|---:|---|
| Background | `#080D18` | Deep blue-black archive workspace background. |
| Surface | `#121B2B` | Elevated cards, sheets, and navigation surfaces. |
| Surface elevated | `#1A2840` | Selected controls and stronger card hierarchy. |
| Primary blue | `#2F80ED` | Main actions and active navigation. |
| Accent cyan | `#50D4FF` | Active indicators, citations, and emphasis. |
| Text primary | `#F4F7FB` | High-contrast titles and values. |
| Text secondary | `#A8B4C8` | Supporting metadata and captions. |
| Warning amber | `#F6C75B` | Review-count badges and attention states. |
| Success green | `#56D49A` | Completed pipeline and approved review states. |
| Error coral | `#FF7E7E` | Failed jobs and explicit error states. |

## Data and provider boundary

The app will ship initially with **synthetic, local fixture records** and persistence for virtual state only. The Google Drive source is represented as immutable provenance; no credentials, Drive writes, or destructive controls are introduced. The existing Ask experience will be satisfied with deterministic keyword/metadata retrieval and templated, citation-grounded responses, avoiding both Google Studio hardcoding and any GenAI API-key requirement. A platform-managed server LLM can remain a future optional enhancement, but it is not required for the functional mobile prototype.

## Preservation commitments

The migration will preserve the existing six primary navigation destinations, duplicate access, modal detail/edit/compare interactions, dark styling, blue/cyan accents, and the source archive safety invariant. Implementation differences required by Expo will be confined to platform and data plumbing; any proposed user-visible change beyond that will be explained and approved first.

## Navigation revision: source-first, image-first, and less dense

The revised primary navigation will use five destinations: **Home**, **Images**, **Search**, **Library**, and **Sources**. The Review queue remains prominent as a Home alert and Library filter; duplicate intelligence and pipeline status move into Sources; and Ask becomes a focused mode within Search rather than a permanent top-level tab. This preserves each existing workflow while reducing the number of competing bottom-navigation destinations.

The Home screen will prioritise a source status summary, a clear search entry point, recent images, and three concise shortcuts rather than a multi-section dashboard. Images will be a dedicated visual grid for photos, screenshots, and memes. Library will remain the universal mixed-file browser.

## Multiple Google Drive sources

PixelDrive will support a collection of independent, **read-only** source records. Each source has its own name, connection state, file count, and last-sync status, so multiple Google Drive accounts or shared drives can be represented without mixing their provenance. The app will make source setup visible from the Sources destination.

Actual Google Drive account linking requires a dedicated Google OAuth client configured for the deployed app and read-only Drive scope. The existing Google Workspace connection cannot be used by the deployed mobile app. Until that OAuth configuration exists, a newly added source is explicitly labelled **Connection setup required**; it is never represented as linked and the app never claims access to a user’s Drive.

## Google OAuth implementation boundary

PixelDrive will use the server-side authorization-code flow with a dedicated Google **Web application** OAuth client and an exact HTTPS callback URL. The app will request `https://www.googleapis.com/auth/drive.metadata.readonly`, which supports listing/indexing Drive metadata but does not grant write access. The backend will validate an opaque state value before exchanging the authorization code, request offline access only when a refresh token is required for scheduled indexing, and store tokens server-side rather than in the Expo client. Each completed authorization will be stored as an independent source so a user can connect multiple Google Drive accounts or shared-drive contexts.
