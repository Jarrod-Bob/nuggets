// Frame timing and main-thread cost of the curry-sauce corner (issue #37).
// Setup and how to read the output: README.md next to this file.
//
//   node bench.mjs http://127.0.0.1:7789
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:7789';
const browser = await chromium.launch({ channel: 'chrome' });

async function open(ctxOptions) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...ctxOptions });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(base + '/');
  await page.getByRole('button', { name: /^Project name:/ }).first().waitFor();
  return { ctx, page, cdp };
}

const metrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

function cost(m0, m1) {
  const wall = m1.Timestamp - m0.Timestamp;
  return {
    'main thread busy %': ((100 * (m1.TaskDuration - m0.TaskDuration)) / wall).toFixed(1),
    'style+layout ms/s': ((1000 * (m1.RecalcStyleDuration - m0.RecalcStyleDuration + m1.LayoutDuration - m0.LayoutDuration)) / wall).toFixed(0),
    'script ms/s': ((1000 * (m1.ScriptDuration - m0.ScriptDuration)) / wall).toFixed(0),
  };
}

const rows = [];

// Idle, one card, six cards: frames sampled with requestAnimationFrame while
// the sauce buttons are clicked (pinned) and the ooze and creep play out.
for (const throttle of [1, 4]) {
  for (const [scenario, cards, seconds] of [['idle bank', 0, 4], ['1 card open', 1, 9], ['6 cards open at once', 6, 9]]) {
    const { ctx, page, cdp } = await open();
    await page.waitForTimeout(800);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await cdp.send('Performance.enable');
    await page.evaluate(() => {
      window.__frames = []; window.__long = [];
      new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(e.duration))).observe({ type: 'longtask' });
      let last = performance.now();
      const loop = now => { window.__frames.push(now - last); last = now; if (!window.__stop) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
    const m0 = await metrics(cdp);
    const sauces = page.getByRole('button', { name: /^Project name:/ });
    for (let i = 0; i < cards; i++) await sauces.nth(i).click();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(seconds * 1000);
    const m1 = await metrics(cdp);
    const { frames, long } = await page.evaluate(() => { window.__stop = true; return { frames: window.__frames.slice(2), long: window.__long }; });
    const sorted = [...frames].sort((a, b) => a - b);
    rows.push({
      cpu: throttle === 1 ? 'full speed' : `${throttle}x slower`, scenario,
      fps: (frames.length / (frames.reduce((a, b) => a + b, 0) / 1000)).toFixed(0),
      'p95 frame ms': sorted[Math.floor(0.95 * (sorted.length - 1))].toFixed(1),
      'worst frame ms': sorted[sorted.length - 1].toFixed(0),
      'frames >33ms': frames.filter(f => f > 33.4).length,
      'long tasks': long.length,
      ...cost(m0, m1),
    });
    await ctx.close();
  }
}

// Six cards left open once their ooze and creep have finished: should cost nothing.
{
  const { ctx, page, cdp } = await open();
  const sauces = page.getByRole('button', { name: /^Project name:/ });
  for (let i = 0; i < 6; i++) await sauces.nth(i).click();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(10500); // ooze 2s, then the creep: ~1.7s delay, up to 1.2s stagger, 6.5s
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  const m0 = await metrics(cdp);
  await page.waitForTimeout(4000);
  rows.push({ cpu: '4x slower', scenario: '6 cards open, settled', ...cost(m0, await metrics(cdp)) });
  await ctx.close();
}

console.table(rows);
await browser.close();
