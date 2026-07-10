
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto('http://localhost:5175/dev/screenshots?view=document-archive')
        await page.wait_for_timeout(2000)
        await page.screenshot(path=r'C:\Users\pinol\Documents\Work\atriax\solid-pancake\.pixel-check\document-archive-actual.png')
        await page.goto('http://localhost:5175/dev/screenshots?view=form-renderer')
        await page.wait_for_timeout(2000)
        await page.screenshot(path=r'C:\Users\pinol\Documents\Work\atriax\solid-pancake\.pixel-check\form-renderer-actual.png')
        await browser.close()

asyncio.run(main())
