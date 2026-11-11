"""Exercise the exported web app, including server/client hydration, with no API required."""

import asyncio
import functools
import os
from pathlib import Path
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright


class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


async def main():
    root = Path(
        os.environ.get("GALLERY_STATIC_ROOT", "work/gallery-web-final")
    ).resolve()
    if not (root / "index.html").is_file():
        raise RuntimeError(
            "Export the web client before running the static smoke check"
        )
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietStaticHandler, directory=str(root))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                executable_path=os.environ.get("CHROMIUM_EXECUTABLE")
                or shutil.which("chromium"),
                args=["--no-sandbox"],
            )
            page = await browser.new_page(viewport={"width": 390, "height": 844})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            await page.goto(f"http://127.0.0.1:{server.server_address[1]}")
            await page.get_by_role("button", name="Explore a demo").wait_for()
            await page.get_by_role(
                "heading", name="Your library", exact=True
            ).wait_for()
            await page.evaluate("document.fonts.ready")
            await page.evaluate(
                "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
            )
            Path("work").mkdir(exist_ok=True)
            await page.screenshot(path="work/gallery-empty-final.png")
            await page.get_by_role("button", name="Explore a demo").focus()
            await page.keyboard.press("Enter")
            await page.get_by_role(
                "button", name="Open speaker_wires_circled.jpg"
            ).wait_for()
            await page.get_by_role("button", name="Images", exact=True).click()
            await page.screenshot(path="work/gallery-grid-final.png")
            assert await page.get_by_role("tab").count() == 4
            assert not errors, errors
            print(
                "PASS: exported web app hydrates, opens demo by keyboard and filters images without browser exceptions"
            )
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()


asyncio.run(main())
