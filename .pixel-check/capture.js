
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const base = 'http://localhost:5175';
  await page.goto(base + '/dev/screenshots?view=document-archive');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check/document-archive-actual.png' });
  await page.goto(base + '/dev/screenshots?view=form-renderer');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check/form-renderer-actual.png' });
  await browser.close();
})();
