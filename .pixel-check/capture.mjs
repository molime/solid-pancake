import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024, deviceScaleFactor: 2 } });
  const out = 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check';

  await page.goto('http://localhost:5176/screenshot-harness.html?view=document-archive', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/document-archive-actual.png` });

  await page.goto('http://localhost:5176/screenshot-harness.html?view=form-renderer&formId=form-hipaa', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/form-renderer-actual.png` });

  await browser.close();
})();
