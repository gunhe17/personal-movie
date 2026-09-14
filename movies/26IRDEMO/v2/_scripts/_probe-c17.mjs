export default async function steps(page, h) {
  await page.waitForTimeout(3500)
  const out = await page.evaluate(() => {
    const hits = []
    for (const e of document.querySelectorAll('*')) {
      if ((e.textContent || '').trim() === '사전기록지' && e.children.length === 0) {
        const r = e.getBoundingClientRect()
        hits.push(`${e.tagName} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} vis=${r.width > 0}`)
      }
    }
    const dock = document.querySelectorAll('[class*="care"], [data-careboard]').length
    return { hits, dock, w: innerWidth }
  })
  console.log('HITS:', JSON.stringify(out))
}
