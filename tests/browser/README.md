# Local browser acceptance checks

These exercise the actual Expo web app in Chromium, using a fresh browser context. They
verify a new empty library, explicitly enable labelled demo data, then import test records.
The session API is real and local. Google Drive account/file/media replies are mocked at the
provider boundary; these are not evidence of live Google consent or AWS behavior.

Requirements: Python Playwright and Chromium (system `chromium`, optional
`CHROMIUM_EXECUTABLE`, or a Playwright-installed browser). Install Playwright into a separate
test environment or use `uv run --with playwright python ...` for the commands below.

1. Run the built Node API locally with `PORT=3340` and a temporary test `JWT_SECRET` supplied
   outside Git. Leave Google OAuth and AI Gateway unconfigured. Do not use production secrets
   or rotate an existing server secret. The default Drive connect error is tested deliberately.
2. From `apps/gallery`, start Metro with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3340`,
   `EXPO_PUBLIC_GALLERY_RETURN_ORIGIN=http://127.0.0.1:8081`, and `EXPO_OFFLINE=1`:
   `corepack pnpm dev:metro`.
3. From the repository root:

   ```bash
   mkdir -p work
   python tests/browser/gallery_sources_smoke.py
   python tests/browser/gallery_layout_smoke.py
   ```

`GALLERY_SMOKE_URL` overrides the default local app URL `http://127.0.0.1:8081`.
The Sources check covers first launch, explicit demo, separate Drive source browsing, signed
media route wiring, collection import, demo removal preserving real data, review/reload,
grid/list controls, search, offline Ask, invalid JSON, and visible connection errors. It also
removes `structuredClone` from the browser runtime to check the catalogue fallback.

The layout check uses keyboard activation and 320, 390, and 1280 px widths. It measures touch
controls, verifies four primary tabs, checks horizontal overflow and captures screenshots
under ignored `work/`.

These checks do not establish native permission/picker behavior, real Google authorization,
actual AI model inference, or AWS persistence. A fresh native build is required for the
`expo-document-picker` and `expo-file-system` dependencies added in the repair checkpoint.

## Exported production web regression (also run in GitHub CI)

Export the web app from `apps/gallery` with `EXPO_OFFLINE=1 corepack pnpm exec expo export
--platform web --output-dir ../../work/gallery-web-final`. Then run from the repository root:

```bash
python tests/browser/gallery_static_smoke.py
```

The script starts and stops its own loopback static server on a free port. It requires no
backend or credentials, checks hydration and keyboard activation, and captures the empty
library and explicit demo grid. It caught the production-only icon font hydration mismatch;
RootLayout now registers the bundled icon font through Expo's font hook before rendering.
`GALLERY_STATIC_ROOT` can select another exported directory.
