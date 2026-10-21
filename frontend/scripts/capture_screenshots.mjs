import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

const OUT_DIR = '/Users/studentuse33gmail.com/Desktop/SubstationAI/docs/ui-redesign/screenshots/before'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function run() {
  // Get admin token and user
  const tokenRes = await fetch('http://localhost:5173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@substationiq.dev', password: 'admin1234' })
  }).then(r => r.json())

  const meRes = await fetch('http://localhost:5173/api/auth/me', {
    headers: { Authorization: `Bearer ${tokenRes.access_token}` }
  }).then(r => r.json())

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const viewports = [
    { name: 'desktop', width: 1280, height: 800, isMobile: false },
    { name: 'mobile', width: 375, height: 667, isMobile: true }
  ]

  for (const vp of viewports) {
    const page = await browser.newPage()
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile })

    // 1. Login page (unauthenticated)
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' })
    await page.screenshot({ path: path.join(OUT_DIR, `login-${vp.name}.png`) })

    // Inject Auth
    await page.evaluate((tok, usr) => {
      localStorage.setItem('siq_token', tok)
      localStorage.setItem('siq_user', JSON.stringify(usr))
    }, tokenRes.access_token, meRes)

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 1000))

    for (const theme of ['light', 'dark']) {
      // Toggle theme if needed
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      if ((theme === 'dark' && !isDark) || (theme === 'light' && isDark)) {
        if (vp.isMobile) {
          await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Light') || b.textContent?.includes('Dark'))
            if (btn) btn.click()
          })
        } else {
          await page.evaluate(() => {
            const btn = document.querySelector('aside button[aria-label="Toggle theme"]')
            if (btn) btn.click()
          })
        }
        await new Promise(r => setTimeout(r, 600))
      }

      // 1. Ask Empty
      await page.evaluate(() => {
        const chatBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Chat'))
        if (chatBtn) chatBtn.click()
      })
      await new Promise(r => setTimeout(r, 600))
      await page.screenshot({ path: path.join(OUT_DIR, `ask-empty-${theme}-${vp.name}.png`) })

      // 2. Ask Answered (send prompt or click suggested)
      await page.evaluate(() => {
        const sug = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('contact resistance'))
        if (sug) sug.click()
      })
      await new Promise(r => setTimeout(r, 5000))
      await page.screenshot({ path: path.join(OUT_DIR, `ask-answered-${theme}-${vp.name}.png`) })

      // 3. Procedures
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Procedures'))
        if (btn) btn.click()
      })
      await new Promise(r => setTimeout(r, 600))
      await page.screenshot({ path: path.join(OUT_DIR, `procedures-${theme}-${vp.name}.png`) })

      // 4. Result Checker
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Result Checker'))
        if (btn) btn.click()
      })
      await new Promise(r => setTimeout(r, 600))
      await page.screenshot({ path: path.join(OUT_DIR, `result-checker-${theme}-${vp.name}.png`) })

      // 5. Diagnosis / DGA
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Diagnose'))
        if (btn) btn.click()
      })
      await new Promise(r => setTimeout(r, 600))
      await page.screenshot({ path: path.join(OUT_DIR, `diagnosis-${theme}-${vp.name}.png`) })

      // 6. Admin
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Admin'))
        if (btn) btn.click()
      })
      await new Promise(r => setTimeout(r, 600))
      await page.screenshot({ path: path.join(OUT_DIR, `admin-${theme}-${vp.name}.png`) })

      // 7. Learn
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Learn'))
        if (btn) btn.click()
      })
      await new Promise(r => setTimeout(r, 600))
      await page.screenshot({ path: path.join(OUT_DIR, `learn-${theme}-${vp.name}.png`) })

      // 8. History
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('History'))
        if (btn) btn.click()
      })
      await new Promise(r => setTimeout(r, 600))
      await page.screenshot({ path: path.join(OUT_DIR, `history-${theme}-${vp.name}.png`) })
    }

    await page.close()
  }

  await browser.close()
  console.log('All baseline screenshots captured successfully!')
}

run().catch(err => {
  console.error('Error running script:', err)
  process.exit(1)
})
