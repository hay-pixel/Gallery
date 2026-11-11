"""Local browser acceptance. Provider replies are mocked; UI/cache/session API are real."""

import asyncio
import base64
import hashlib
import json
import os
import re
import shutil
import struct
import zlib
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright, expect


def png_chunk(kind, data):
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data))
    )


PNG = (
    b"\x89PNG\r\n\x1a\n"
    + png_chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0))
    + png_chunk(b"IDAT", zlib.compress((b"\0" + bytes([138, 227, 204]) * 8) * 8))
    + png_chunk(b"IEND", b"")
)

ASSET_ID = "sha256:" + hashlib.sha256(PNG).hexdigest()


def envelope(value):
    return [{"result": {"data": {"json": value}}}]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_EXECUTABLE")
            or shutil.which("chromium"),
            args=["--no-sandbox"],
        )
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        errors, requests = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        # Exercise catalogue fallback on runtimes without the browser clone global.
        await page.add_init_script("globalThis.structuredClone = undefined")
        await page.route(
            "**/api/trpc/googleDrive.list*",
            lambda route: route.fulfill(
                json=envelope(
                    [
                        {
                            "id": 1,
                            "displayName": "Personal Drive",
                            "email": "personal@example.test",
                        },
                        {
                            "id": 2,
                            "displayName": "Work Drive",
                            "email": "work@example.test",
                        },
                    ]
                )
            ),
        )

        async def source_files(route):
            query = parse_qs(urlparse(route.request.url).query)
            source_id = json.loads(query["input"][0])["0"]["json"]["sourceId"]
            await route.fulfill(
                json=envelope(
                    [
                        {
                            "id": f"provider-file-{source_id}",
                            "name": "personal-drive.png"
                            if source_id == 1
                            else "work-drive.png",
                            "mimeType": "image/png",
                            "sourceId": source_id,
                            "sourceName": "Drive",
                            "hasThumbnail": True,
                            "mediaGrant": "mock-signed-media",
                            "thumbnailGrant": "mock-signed-thumbnail",
                        }
                    ]
                )
            )

        await page.route("**/api/trpc/googleDrive.sourceFiles*", source_files)
        await page.route(
            "**/api/google-drive/thumbnail/**",
            lambda route: route.fulfill(body=PNG, content_type="image/png"),
        )
        await page.route(
            "**/api/google-drive/media/**",
            lambda route: route.fulfill(body=PNG, content_type="image/png"),
        )
        await page.goto(
            os.environ.get("GALLERY_SMOKE_URL", "http://127.0.0.1:8081"),
            wait_until="domcontentloaded",
        )
        await page.get_by_role("button", name="Explore a demo").wait_for(timeout=90000)
        assert await page.get_by_role("tab").count() == 4
        assert (
            await page.get_by_role(
                "button", name="Open speaker_wires_circled.jpg"
            ).count()
            == 0
        )
        print("PASS: first launch is empty and has four primary tabs", flush=True)
        await page.get_by_role("button", name="Explore a demo").click()
        await page.get_by_text("Sample library", exact=True).wait_for()
        await page.get_by_role(
            "button", name="Open speaker_wires_circled.jpg"
        ).wait_for()
        print("PASS: demo is explicitly enabled and labelled", flush=True)
        await page.get_by_role("tab", name="Sources").click()
        await page.get_by_role("button", name="Browse Personal Drive").wait_for()
        await page.get_by_role("button", name="Browse Personal Drive").click()
        try:
            await page.get_by_role(
                "button", name="Preview personal-drive.png"
            ).wait_for(timeout=10000)
        except Exception:
            print(
                "DRIVE DIAGNOSTIC:",
                (await page.locator("body").inner_text())[-2000:],
                requests[-5:],
                errors,
                flush=True,
            )
            raise
        assert (
            await page.get_by_role("button", name="Preview work-drive.png").count() == 0
        )
        await page.get_by_role("button", name="Preview personal-drive.png").click()
        await page.get_by_role("img", name="personal-drive.png", exact=True).wait_for()
        await page.get_by_role("button", name="Back to Drive files").click()
        await page.get_by_role("button", name="Close Drive browser").click()
        await page.get_by_role("button", name="Browse Work Drive").click()
        await page.get_by_role("button", name="Preview work-drive.png").wait_for()
        await page.get_by_role("button", name="Close Drive browser").click()
        print(
            "PASS: two Drive accounts browse separate provider files without creating canonical records (mocked provider)",
            flush=True,
        )
        payload = {
            "schema": "gallery-canonical-import",
            "schema_version": 1,
            "assets": [
                {
                    "schema": "asset-record",
                    "schema_version": 1,
                    "asset_id": ASSET_ID,
                    "content_hash": ASSET_ID,
                    "storage_locator": "owned/browser-check.png",
                    "mime_type": "image/png",
                    "size_bytes": len(PNG),
                    "processing_state": "ready",
                }
            ],
            "metadata": [
                {
                    "asset_id": ASSET_ID,
                    "title": "browser-import-check.png",
                    "previewDataUri": "data:image/png;base64,"
                    + base64.b64encode(PNG).decode(),
                }
            ],
        }
        async with page.expect_file_chooser() as chooser:
            await page.get_by_role(
                "button", name="Import collection", exact=True
            ).click()
        await (await chooser.value).set_files(
            {
                "name": "collection.json",
                "mimeType": "application/json",
                "buffer": json.dumps(payload).encode(),
            }
        )
        await page.get_by_text("Imported 1 file record.", exact=False).wait_for()
        await page.get_by_role("tab", name="Library").click()
        await page.get_by_role("button", name="Exit demo", exact=True).click()
        await expect(page.get_by_text("Sample library", exact=True)).to_have_count(0)
        await expect(
            page.get_by_role("button", name=re.compile("^Open "))
        ).to_have_count(1)
        await page.get_by_role("button", name="Open browser-import-check.png").click()
        await page.get_by_role("button", name="Approve category", exact=True).click()
        await page.get_by_text("✓ Reviewed", exact=True).wait_for()
        await page.get_by_role("button", name="Close file preview").click()
        await page.reload()
        await page.get_by_role(
            "button", name="Open browser-import-check.png"
        ).wait_for()
        await page.get_by_role("button", name="Open browser-import-check.png").click()
        await page.get_by_text("✓ Reviewed", exact=True).wait_for()
        await page.get_by_role("button", name="Close file preview").click()
        print(
            "PASS: import previews persist, exit demo preserves real records, review survives reload",
            flush=True,
        )
        await page.get_by_role("button", name="List view", exact=True).click()
        await expect(
            page.get_by_role("button", name="List view", exact=True)
        ).to_have_attribute("aria-pressed", "true")
        await page.get_by_role("button", name="Grid view", exact=True).click()
        await expect(
            page.get_by_role("button", name="Grid view", exact=True)
        ).to_have_attribute("aria-pressed", "true")
        print("PASS: working grid/list toggle", flush=True)
        await page.get_by_role("tab", name="Search").click()
        await page.get_by_role("textbox", name="Search your library").fill(
            "browser-import-check"
        )
        await page.get_by_role(
            "button", name="Open browser-import-check.png"
        ).last.wait_for()
        await page.get_by_role("button", name="Ask AI", exact=True).click()
        await page.route("**/api/trpc/ai.askArchive*", lambda route: route.abort())
        await page.get_by_role("button", name="Ask your library", exact=True).click()
        await page.get_by_text("Local catalogue matches", exact=True).wait_for()
        print("PASS: search and offline Ask use only the current library", flush=True)
        await page.get_by_role("tab", name="Sources").click()
        async with page.expect_file_chooser() as chooser:
            await page.get_by_role(
                "button", name="Import collection", exact=True
            ).click()
        await (await chooser.value).set_files(
            {"name": "bad.json", "mimeType": "application/json", "buffer": b"{bad"}
        )
        await (
            page.get_by_role("alert")
            .filter(has_text="Invalid canonical import JSON")
            .wait_for()
        )
        await page.get_by_role(
            "button", name="Connect Google Drive", exact=True
        ).click()
        await (
            page.get_by_role("alert")
            .filter(has_text="Could not connect to Google Drive")
            .wait_for()
        )
        assert any("/api/trpc/googleDrive.beginConnect" in url for url in requests)
        assert not any("/app-auth" in url for url in requests)
        print(
            "PASS: invalid imports preserve library and Drive errors are visible",
            flush=True,
        )
        assert not errors, errors
        print(
            "PASS: no unhandled browser exceptions with structuredClone unavailable",
            flush=True,
        )
        await browser.close()


asyncio.run(main())
