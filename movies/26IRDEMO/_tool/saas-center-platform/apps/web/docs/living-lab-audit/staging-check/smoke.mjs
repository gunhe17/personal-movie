// 스테이징 1차 스모크 — 읽기 전용 (허용된 POST: verify-link 존재하지 않는 UUID 1건)
import { chromium } from 'playwright';

const BASE = 'https://app.staging.mindscope.kr';
const SHOTS = '/Users/janghojun/workspace/service/saas/saas-center-platform/apps/web/docs/living-lab-audit/staging-check/shots';

const log = (...a) => console.log('[smoke]', ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

async function goAndShot(path, name, waitMs = 1500) {
  const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => { log(name, 'goto error:', e.message); return null; });
  await page.waitForTimeout(waitMs);
  const finalUrl = page.url();
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  log(name, '| status:', resp ? resp.status() : 'n/a', '| finalUrl:', finalUrl);
  return { resp, finalUrl };
}

// 3. /login
{
  const { finalUrl } = await goAndShot('/login', '03-login');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  log('03-login snippet:', bodyText.replace(/\s+/g, ' ').slice(0, 300));
}

// 4. /verify-link (no params)
{
  const { finalUrl } = await goAndShot('/verify-link', '04-verify-link-noparam');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  log('04 finalUrl:', finalUrl);
  log('04 snippet:', bodyText.replace(/\s+/g, ' ').slice(0, 400));
  log('04 redirectedToLogin:', finalUrl.includes('/login'));
}

// 5. /verify-link with fake UUID + submit code (allowed POST)
{
  const { finalUrl } = await goAndShot('/verify-link?send_link_id=00000000-0000-0000-0000-000000000000', '05-verify-link-uuid');
  let bodyText = await page.locator('body').innerText().catch(() => '');
  log('05 finalUrl:', finalUrl);
  log('05 snippet(before):', bodyText.replace(/\s+/g, ' ').slice(0, 400));

  // 인증번호 입력 시도
  const inputs = page.locator('input:visible');
  const n = await inputs.count();
  log('05 visible inputs:', n);
  if (n > 0) {
    // 단일 입력 or OTP 분할 입력 모두 대응
    if (n === 1) {
      await inputs.first().fill('000000').catch(e => log('fill err', e.message));
    } else {
      for (let i = 0; i < n; i++) await inputs.nth(i).fill('0').catch(() => {});
    }
    // 확인 버튼 클릭
    const btn = page.locator('button:visible', { hasText: /확인|인증|검증|제출/ }).first();
    if (await btn.count()) {
      await btn.click().catch(e => log('click err', e.message));
      await page.waitForTimeout(2500);
    } else {
      // fallback: 아무 submit 버튼
      const anyBtn = page.locator('button[type=submit]:visible').first();
      if (await anyBtn.count()) { await anyBtn.click().catch(() => {}); await page.waitForTimeout(2500); }
      else log('05 no submit button found');
    }
    bodyText = await page.locator('body').innerText().catch(() => '');
    log('05 snippet(after submit):', bodyText.replace(/\s+/g, ' ').slice(0, 500));
    await page.screenshot({ path: `${SHOTS}/05-verify-link-after-submit.png` });
  }
}

// 6. /verify-result (no params)
{
  const { finalUrl } = await goAndShot('/verify-result', '06-verify-result');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  log('06 finalUrl:', finalUrl);
  log('06 snippet:', bodyText.replace(/\s+/g, ' ').slice(0, 400));
}

// 7. /subscription
{
  const { finalUrl } = await goAndShot('/subscription', '07-subscription');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  log('07 finalUrl:', finalUrl);
  log('07 snippet:', bodyText.replace(/\s+/g, ' ').slice(0, 400));
}

await browser.close();
log('done');
