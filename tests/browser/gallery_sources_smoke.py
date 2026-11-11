import os, shutil
import asyncio, base64, hashlib, json
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_EXECUTABLE")
            or shutil.which("chromium"),
            headless=True,
            args=["--no-sandbox"],
        )
        page = await b.new_page(viewport={"width": 390, "height": 844})
        errors = []
        requests = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("request", lambda req: requests.append(req.url))
        await page.goto(
            os.environ.get("GALLERY_SMOKE_URL", "http://127.0.0.1:8081"),
            wait_until="domcontentloaded",
        )
        await page.get_by_text("11 assets", exact=True).wait_for(timeout=90000)
        await page.get_by_role("tab", name="Sources").click()
        await page.get_by_text("Import canonical JSON", exact=True).wait_for()
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6I9sAAAAASUVORK5CYII="
        )
        aid = "sha256:" + hashlib.sha256(png).hexdigest()
        payload = {
            "schema": "gallery-canonical-import",
            "schema_version": 1,
            "assets": [
                {
                    "schema": "asset-record",
                    "schema_version": 1,
                    "asset_id": aid,
                    "content_hash": aid,
                    "storage_locator": "owned/browser-check.png",
                    "mime_type": "image/png",
                    "size_bytes": len(png),
                    "processing_state": "ready",
                }
            ],
            "metadata": [
                {
                    "asset_id": aid,
                    "title": "browser-import-check.png",
                    "previewDataUri": "data:image/png;base64,"
                    + base64.b64encode(png).decode(),
                }
            ],
        }
        async with page.expect_file_chooser() as event:
            await page.get_by_text("Import canonical JSON", exact=True).click()
        await (await event.value).set_files(
            {
                "name": "collection.json",
                "mimeType": "application/json",
                "buffer": json.dumps(payload).encode(),
            }
        )
        await page.get_by_text("Imported 1 asset record.", exact=False).wait_for()
        await page.get_by_text("12 canonical assets", exact=False).wait_for()
        print(
            "PASS: real Sources action opens picker, parses collection and persists merged record"
        )
        await page.get_by_role("tab", name="Images").click()
        await page.get_by_text("browser-import-check.png", exact=True).last.wait_for()
        await page.get_by_label("browser-import-check.png", exact=True).last.wait_for()
        await page.screenshot(path="work/images-after.png")
        print("PASS: imported preview appears in Images")
        await page.reload()
        await page.get_by_text("browser-import-check.png", exact=True).last.wait_for()
        print("PASS: imported record survives page reload")
        await page.get_by_role("tab", name="Sources").click()
        async with page.expect_file_chooser() as event:
            await page.get_by_text("Import canonical JSON", exact=True).click()
        await (await event.value).set_files(
            {"name": "bad.json", "mimeType": "application/json", "buffer": b"{bad"}
        )
        await (
            page.get_by_role("alert")
            .filter(has_text="Invalid canonical import JSON")
            .wait_for()
        )
        await page.get_by_text("12 canonical assets", exact=False).wait_for()
        print("PASS: invalid JSON shows error and preserves library")
        await page.get_by_text("Connect a Google Drive", exact=True).click()
        await (
            page.get_by_role("alert")
            .filter(has_text="Could not connect to Google Drive")
            .wait_for(timeout=15000)
        )
        assert any("/api/trpc/googleDrive.beginConnect" in u for u in requests), (
            requests[-6:]
        )
        assert not any("/app-auth" in u for u in requests)
        print(
            "PASS: Drive action calls Gallery beginConnect and shows missing server configuration"
        )
        await page.get_by_role("tab", name="Search").click()
        await page.get_by_text("Ask AI", exact=True).click()
        await page.route("**/api/trpc/ai.askArchive*", lambda route: route.abort())
        await page.get_by_placeholder("Ask a question about your archive...").fill(
            "browser-import-check"
        )
        await page.get_by_placeholder("Ask a question about your archive...").press(
            "Enter"
        )
        await page.get_by_text("Local catalogue matches", exact=True).wait_for(
            timeout=15000
        )
        print(
            "PASS: offline Ask uses actual imported library, not unrelated fixture records"
        )
        await page.get_by_role("tab", name="Sources").click()
        await page.get_by_text("Browse local device", exact=True).click()
        await page.get_by_text(
            "Device media discovery is not connected", exact=False
        ).wait_for()
        print(
            "PASS: local browser reports unavailable discovery without claiming permission granted"
        )
        assert errors == [], errors
        print("PASS: no unhandled browser exceptions")
        await b.close()


asyncio.run(main())
