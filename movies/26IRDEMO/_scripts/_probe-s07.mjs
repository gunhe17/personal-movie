export default async function steps(page, h) {
  await h.beat('회기 상세')
  const before = await page.evaluate(() => document.body.innerText.slice(0, 0) || '')
  await h.click('button:has-text("일지 초안 생성")', '클릭')
  await new Promise(r => setTimeout(r, 45000))
  const info = await page.evaluate(() => {
    const txt = document.body.innerText
    return {
      hasSheet: /서식|SOAP|BIRP|DAP|가족센터/.test(txt),
      formats: ['기본 서식','SOAP','DAP','BIRP','가족센터'].filter(f => txt.includes(f)),
      snippet: txt.split('\n').filter(l => /초안|서식|필드노트|전사|실패|오류|못/.test(l)).slice(0, 8)
    }
  })
  process.stdout.write('\nPROBE ' + JSON.stringify(info, null, 1) + '\n')
  await h.hold(500, '끝')
}
