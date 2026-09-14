export default async function steps(page, h) {
  await page.waitForTimeout(3000)
  console.log('URL0', page.url())
  await h.click('text=우리아이심리지원서비스 >> nth=0', '카드')
  await page.waitForTimeout(3000)
  console.log('URL1', page.url())
  const t = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 1200))
  console.log('TEXT:', t)
}
