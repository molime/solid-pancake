import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const base = 'http://localhost:5179';
  // Document archive via screenshot harness
  await page.goto(base + '/screenshot-harness.html?view=document-archive');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check/document-archive-actual.png' });
  // Form submission via actual route
  await page.goto(base + '/forms/form-hipaa?view=form-renderer');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check/form-renderer-actual.png' });
  await browser.close();
})();
