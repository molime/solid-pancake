import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024, deviceScaleFactor: 2 } });
  const messages = [];
  page.on('console', (msg) => messages.push(msg.text()));
  page.on('pageerror', (err) => messages.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:5176/screenshot-harness.html?view=form-renderer', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(messages.join('\n'));
  await page.screenshot({ path: 'C:/Users/pinol/Documents/Work/atriax/solid-pancake/.pixel-check/form-renderer-actual.png' });
  await browser.close();
})();
