// Screenshots at iPhone sizes and a full automated round. Needs `npm run build` and `npm run preview`.
// node scripts/check.mjs [url] [outdir]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:4173/'
const out = process.argv[3] ?? 'debug/screens'
mkdirSync(out, { recursive: true })
const executablePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] })
const sizes = [
  [390, 844],
  [402, 874],
]
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
/** Buttons are replaced between turns; a click on a stale one is simply retried next loop. */
const tap = (el) => el?.click({ force: true, timeout: 2000 }).then(() => true, () => false) ?? false

async function playRound(page, tag, { wrongEvery = 0, shots = [] } = {}) {
  let n = 0
  for (let guard = 0; guard < 200; guard++) {
    if (await page.$('.result-actions')) return true
    const learn = await page.$('.learn-btn')
    if (learn) {
      if (shots.includes('learn')) await page.screenshot({ path: `${out}/${tag}-learn.png` })
      await tap(learn)
      await wait(700)
      continue
    }
    const id = await page.evaluate(() => window.__rkTurn?.word?.id)
    const opts = await page.$$('.opt:not(.dim)')
    if (!id || opts.length === 0) {
      await wait(400)
      continue
    }
    n++
    if (wrongEvery && n % wrongEvery === 0) {
      const wrong = await page.$(`.opt:not([data-id="${id}"])`)
      if (wrong) {
        await tap(wrong)
        await wait(500)
        if (shots.includes('wrong') && n === wrongEvery) await page.screenshot({ path: `${out}/${tag}-wrong.png` })
      }
    }
    const good = await page.$(`.opt[data-id="${id}"]`)
    if (!good) {
      await wait(300)
      continue
    }
    if (!(await tap(good))) continue
    const jumps = Number(await page.textContent('.counter b'))
    if (shots.includes('jump') && [4, 11, 16, 26].includes(jumps)) await wait(900), await page.screenshot({ path: `${out}/${tag}-jump${jumps}.png` })
    await wait(jumps % 5 === 0 ? 1500 : 800)
    if (jumps >= 30) {
      await wait(1500)
      if (shots.includes('finale')) await page.screenshot({ path: `${out}/${tag}-finale.png` })
    }
  }
  return false
}

if (process.argv.includes('--states')) {
  // Sentences theme in English to Dutch, and the sleep screen.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(url)
  await page.evaluate(() => {
    const p = { settings: { direction: 'en-nl', themeId: 'korte-zinnen', sound: true, music: true, catSounds: true }, lastRoundAt: Date.now() - 30 * 3600e3, roundsByDay: { '2026-01-01': 1 }, height: 200 }
    localStorage.setItem('rainbowkitten.v1', JSON.stringify({ schemaVersion: 1, activeProfile: 'wyne', profiles: { wyne: p } }))
  })
  await page.reload()
  await page.waitForSelector('.btn-play')
  await wait(800)
  await page.screenshot({ path: `${out}/state-sleep.png` })
  await page.click('.menu-katja')
  await wait(600)
  await page.screenshot({ path: `${out}/state-wake.png` })
  await page.click('.btn-play')
  await page.waitForSelector('.scene-canvas')
  for (let i = 0; i < 12; i++) {
    await wait(900)
    const learn = await page.$('.learn-btn')
    if (i === 0) await page.screenshot({ path: `${out}/state-zin-learn.png` })
    if (learn) await tap(learn)
    else {
      if (i > 4) {
        await page.screenshot({ path: `${out}/state-zin-question.png` })
        break
      }
      const id = await page.evaluate(() => window.__rkTurn?.word?.id)
      await tap(await page.$(`.opt[data-id="${id}"]`))
    }
  }
  await browser.close()
  process.exit(0)
}

if (process.argv.includes('--walls')) {
  // Close-ups of Katja hanging on the left and the right wall, to check the paws touch the wall.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(url)
  await page.click('.btn-play')
  await page.waitForSelector('.scene-canvas')
  await wait(1500)
  let shot = 0
  for (let i = 0; i < 40 && shot < 2; i++) {
    const side = await page.evaluate(() => window.__rk.scene.side)
    if ((shot === 0 && side === 'left') || (shot === 1 && side === 'right')) {
      await wait(1600)
      await page.screenshot({ path: `${out}/wall-${side}.png`, clip: side === 'left' ? { x: 0, y: 60, width: 220, height: 380 } : { x: 170, y: 60, width: 220, height: 380 } })
      shot++
      continue
    }
    const learn = await page.$('.learn-btn')
    if (learn) await tap(learn)
    else {
      const id = await page.evaluate(() => window.__rkTurn?.word?.id)
      const good = await page.$(`.opt[data-id="${id}"]`)
      if (good) await tap(good)
    }
    await wait(900)
  }
  await browser.close()
  process.exit(0)
}

for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(url)
  await page.waitForSelector('.btn-play')
  await wait(800)
  const tag = `${w}x${h}`
  await page.screenshot({ path: `${out}/${tag}-menu.png` })
  await page.click('.btn-play')
  await page.waitForSelector('.scene-canvas')
  await wait(1500)
  await page.screenshot({ path: `${out}/${tag}-game.png` })
  const full = w === 390
  const ok = await playRound(page, tag, full ? { wrongEvery: 7, shots: ['learn', 'wrong', 'jump', 'finale'] } : {})
  await wait(1000)
  await page.screenshot({ path: `${out}/${tag}-result.png` })
  console.log(tag, 'round 1 done:', ok)
  if (full) {
    // Second round of the day: confetti cat.
    await page.click('.result-actions .btn-play')
    await wait(800)
    const ok2 = await playRound(page, `${tag}-r2`, { shots: ['finale'] })
    await page.screenshot({ path: `${out}/${tag}-r2-result.png` })
    console.log(tag, 'round 2 done:', ok2)
    await page.click('.result-actions .btn-small')
    await wait(800)
    await page.screenshot({ path: `${out}/${tag}-menu-after.png` })
    for (const [sel, name] of [
      ['.menu-row .btn:nth-child(1)', 'woordkaart'],
      ['.menu-row .btn:nth-child(2)', 'verzameling'],
      ['.menu-row .btn:nth-child(3)', 'instellingen'],
    ]) {
      await page.click(sel)
      await wait(600)
      await page.screenshot({ path: `${out}/${tag}-${name}.png` })
      await page.click('.back')
      await wait(400)
    }
  }
  console.log(tag, 'errors:', errors.length ? errors : 'none')
  await ctx.close()
}
await browser.close()
