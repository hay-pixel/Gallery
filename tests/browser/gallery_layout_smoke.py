"""Responsive layout and keyboard checks against the actual local web app."""

import asyncio
import os
import shutil
from playwright.async_api import async_playwright, expect


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_EXECUTABLE")
            or shutil.which("chromium"),
            args=["--no-sandbox"],
        )
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        await page.goto(os.environ.get("GALLERY_SMOKE_URL", "http://127.0.0.1:8081"))
        await page.get_by_role("button", name="Explore a demo").wait_for()
        await page.get_by_role("button", name="Explore a demo").focus()
        await page.keyboard.press("Enter")
        await page.get_by_text("Sample library", exact=True).wait_for()
        for width in [320, 390, 1280]:
            await page.set_viewport_size({"width": width, "height": 844})
            await page.get_by_role("button", name="Grid view", exact=True).click()
            card = page.get_by_role("button", name="Open bank_transfer_receipt.png")
            await card.wait_for()
            all_filter = page.get_by_role("button", name="All", exact=True)
            height = await all_filter.evaluate("e => e.getBoundingClientRect().height")
            assert height >= 44, (width, height)
            assert await page.get_by_role("tab").count() == 4
            tab = page.get_by_role("tab", name="Library", exact=True)
            box = await tab.bounding_box()
            assert box and box["y"] + box["height"] <= 845, (width, box)
            await expect(card).to_be_visible()
            overflow = await page.evaluate(
                "document.documentElement.scrollWidth > innerWidth"
            )
            assert not overflow, (width, "horizontal page overflow")
            await page.screenshot(path=f"work/gallery-library-{width}.png")
            print(
                f"PASS: {width}px library, 44px filters, four tabs, no page overflow",
                flush=True,
            )
        for name in ["Search", "Sources", "Settings"]:
            await page.get_by_role("tab", name=name, exact=True).click()
            await expect(
                page.get_by_role("tab", name=name, exact=True)
            ).to_have_attribute("aria-selected", "true")
            await page.screenshot(path=f"work/gallery-{name.lower()}-desktop.png")
        await browser.close()


asyncio.run(main())
