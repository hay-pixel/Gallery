import os, shutil
import asyncio
from playwright.async_api import async_playwright, expect


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_EXECUTABLE")
            or shutil.which("chromium"),
            args=["--no-sandbox"],
        )
        page = await b.new_page(viewport={"width": 390, "height": 844})
        await page.goto(os.environ.get("GALLERY_SMOKE_URL", "http://127.0.0.1:8081"))
        await page.get_by_text("11 assets", exact=True).wait_for()
        for route in ["images", "library", "search"]:
            tab = page.get_by_role("tab", name=route.title())
            await tab.click()
            await expect(tab).to_have_attribute("aria-selected", "true")
            label = page.get_by_text("All", exact=True).and_(page.locator(":visible")).last
            await label.wait_for()
            rect = await label.locator("..").evaluate(
                "(e)=>({height:e.getBoundingClientRect().height,y:e.getBoundingClientRect().y})"
            )
            height = rect["height"]
            if route == "images":
                assert rect["y"] < 120, rect
            assert 32 <= height <= 56, (route, height)
            await page.screenshot(path=f"work/{route}-repaired.png")
            print("PASS:", route, "filter height", height)
        await b.close()


asyncio.run(main())
