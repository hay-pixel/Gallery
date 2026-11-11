# Local browser regression checks

These checks exercise the actual Expo web app in Chromium rather than mocked SSR markup.
They use a new temporary browser context and test-only import records. Run against a local
checkout with the existing sample catalogue enabled; they are not live AWS/OAuth acceptance.

Requirements: Python Playwright and Chromium (system `chromium`, optional
`CHROMIUM_EXECUTABLE`, or a Playwright-installed browser). From the repository root, after
normal project setup, install Playwright into a separate test environment or use
`uv run --with playwright python ...` for the commands below.

1. Run the existing Node API locally with `PORT=3340` and a temporary test `JWT_SECRET`
   supplied outside Git. Leave Google OAuth and AI Gateway unconfigured for this check.
   Do not use production credentials or rotate an existing server secret.
2. Start Metro from `apps/gallery` with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3340`,
   `EXPO_PUBLIC_GALLERY_RETURN_ORIGIN=http://127.0.0.1:8081`, and `EXPO_OFFLINE=1`:
   `corepack pnpm dev:metro`.
3. Run from the repository root:

   ```bash
   mkdir -p work
   python tests/browser/gallery_sources_smoke.py
   python tests/browser/gallery_layout_smoke.py
   ```

The default app URL is `http://127.0.0.1:8081`; `GALLERY_SMOKE_URL` overrides it for another
local forwarded preview. The Sources check verifies picker opening, valid JSON merge, actual
preview display, reload persistence, invalid-JSON rollback, correct Drive authorization
endpoint and visible missing-configuration error, offline Ask against the imported catalogue,
and truthful local-discovery availability. The layout check measures filter targets and
checks Images' vertical position at 390×844. Screenshots go into ignored `work/`.

These scripts do not establish native picker/permission behavior, successful Google consent,
real inference, deployed ownership isolation, or AWS restart persistence. Native builds must
be rebuilt after adding `expo-document-picker` and `expo-file-system`.
