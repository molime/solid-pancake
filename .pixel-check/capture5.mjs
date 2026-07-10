import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  const base = 'http://localhost:5178/screenshot-harness.html';
  await page.goto(base + '?view=document-archive');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check/document-archive-actual.png' });
  await page.goto(base + '?view=form-renderer');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check/form-renderer-actual.png' });
  await browser.close();
})();
