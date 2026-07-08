
import { chromium } from 'playwright'
(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const ticketUrl = process.argv[2]
  const targetUrl = process.argv[3] || 'http://localhost:5173/hr/candidates'
  await page.goto(ticketUrl)
  await page.waitForURL(url => !url.searchParams.has('__clerk_ticket'), { timeout: 30000 })
  console.log('signed in, url:', page.url())
  await page.goto('http://localhost:5173/select-agency')
  await page.waitForSelector('text=Select Agency', { timeout: 10000 })
  const agencyButton = await page.$('button:has-text("Role: admin")')
  if (agencyButton) {
    await agencyButton.click()
    try {
      await page.waitForURL(url => !url.pathname.includes('/select-agency'), { timeout: 30000 })
    } catch {}
    console.log('after agency select url:', page.url())
  }
  await page.goto(targetUrl)
  await page.waitForLoadState('networkidle')
  console.log('final url:', page.url())
  await browser.close()
})()
