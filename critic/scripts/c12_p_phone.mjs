// Critic run 12, session P: a phone (390 x 844) and a small laptop (1280 x 720): the title, the 1938 world,
// each bottom-bar panel opened by its button, God Mode's tools, the editor, a week of play. Overlaps and
// off-screen controls counted.
import { launch, BASE, shot, save } from './c12_lib.mjs';

const out = { views: [] };
for (const [w, h, name] of [[390, 844, 'phone'], [1280, 720, 'laptop']]) {
  const { browser, page, errors } = await launch(w, h);
  const v = { name, w, h, steps: [] };
  const S = async (n) => shot(page, `c12p_${name}_${n}.png`);
  const offscreen = () => page.evaluate(() => [...document.querySelectorAll('button, select, input')].filter((b) => b.offsetParent !== null).filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1; }).map((b) => (b.innerText || b.title || b.tagName).trim().slice(0, 30)));
  const docScroll = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  try {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(4000);
    v.steps.push({ s: 'title', off: await offscreen(), scroll: await docScroll(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 600) });
    await S('00_title');
    await page.goto(`${BASE}/?scenario=1938&paused=1&seed=3301`);
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 120_000 });
    await page.waitForTimeout(3000);
    v.steps.push({ s: 'world', off: await offscreen(), scroll: await docScroll() });
    await S('01_world');
    for (const label of ['Statistics', 'History', 'Settings', 'Editor', 'God Mode']) {
      const b = page.getByRole('button', { name: label, exact: true }).first();
      const vis = await b.isVisible().catch(() => false);
      if (!vis) { v.steps.push({ s: label, visible: false }); continue; }
      await b.click();
      await page.waitForTimeout(1200);
      v.steps.push({ s: label, visible: true, off: await offscreen(), scroll: await docScroll(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 900) });
      await S(`02_${label.replace(' ', '')}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      // close by clicking the same button again if still open
      const still = await page.evaluate((l) => document.body.innerText.includes(l === 'God Mode' ? 'Click a province' : '__none__'), label);
      if (still) await b.click().catch(() => {});
      await page.waitForTimeout(400);
    }
    // a week of play at the default speed
    await page.evaluate(() => { const h = window.__warsim.hud; h.setSpeedLevel(3); if (h.paused.value) h.togglePause(); });
    await page.waitForTimeout(12000);
    await S('03_played');
    v.steps.push({ s: 'played', date: await page.evaluate(() => document.body.innerText.match(/\d+ \w+ 19\d\d/)?.[0] ?? null), off: await offscreen() });
  } catch (e) {
    v.fatal = String(e?.stack ?? e);
  }
  v.errors = errors;
  out.views.push(v);
  save('c12_p.json', out);
  await browser.close();
}
console.log(JSON.stringify(out).slice(0, 3000));
