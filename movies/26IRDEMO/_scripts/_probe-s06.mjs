export default async function steps(page, h) {
  await h.beat('필드노트'); await new Promise(r=>setTimeout(r,5000))
  const info = await page.evaluate(() => {
    const t = document.body.innerText
    return { 전사있나: !t.includes('전사 데이터가 없어요'),
             화자: t.split('\n').filter(l=>/상담사|내담자|하준/.test(l)).slice(0,6),
             본문: t.split('\n').filter(l=>/인사|축구|공 차기|세 번/.test(l)).slice(0,5) }
  })
  process.stdout.write('\nPROBE ' + JSON.stringify(info, null, 1) + '\n')
  await h.hold(300,'끝')
}
