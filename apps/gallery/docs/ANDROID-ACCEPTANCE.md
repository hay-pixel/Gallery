# Android Acceptance Protocol & Verification Checklist

**Package ID:** `com.ollamabinsaden.gallery`  
**Target Version:** `1.1.0` (versionCode `6`)  
**Deep Link Scheme:** `ollamabinsaden-gallery`

---

## 1. Build Verification

- **Command:** `lim gradle build . --expo-app-dir apps/gallery --upload gallery-selective-port-1.1.0-debug.apk`
- **Output Artifact:** `gallery-selective-port-1.1.0-debug.apk`
- **Permissions Audited:** Minimum read permissions only (`POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE`).
- **Security Check:** Zero write permissions requested, zero global cleartext traffic enabled (`usesCleartextTraffic: false`), zero raw Ollama port/host variables exposed.

---

## 2. Remote Limrun Acceptance Journeys

The 10 mandatory acceptance journeys:

1. **Cold Launch:** App launches to Home without canonical assets or connected Drive without crashing or ANR.
2. **Navigation:** Accessible navigation across Home, Images, Search, Library, Sources, and Settings tabs.
3. **Media Permissions:** Honest handling of denied, limited, and granted permissions in local source browser.
4. **Document Picker:** Safe handling of document picker cancellation and non-JSON file selection.
5. **Canonical Import:** Atomic merge of valid canonical JSON export with duplicate detection and error reporting.
6. **Offline Catalogue Browse:** Local filtering and deterministic sorting over loaded canonical views without Search gateway connectivity.
7. **Degraded Search State:** Clear distinction between ready empty results and unavailable/stale service states.
8. **Private Ollama Status:** Settings display of model and reasoning state without exposing private backend port or host.
9. **Companion State:** Independent detection and status reporting for optional Extract/Assist companions.
10. **Persistence Verification:** User annotations and preferred occurrences survive termination and app relaunch.

---

## 3. Physical Device Verification (Samsung S23 Ultra)

- **Target Device:** Samsung Galaxy S23 Ultra (Android 14 / One UI 6)
- **Status:** Outstanding until physical sideloading and manual touch verification of the 10 journeys is confirmed.

